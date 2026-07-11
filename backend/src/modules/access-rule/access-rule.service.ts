import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { UserRole } from "../auth/types.js";
import { HttpError } from "../../utils/http.js";
import { assertPermission, assertRole } from "../rbac/rbac.guard.js";
import type { NomineeStore } from "../nominee/nominee.store.js";
import type { VaultStore } from "../vault/vault.store.js";
import type {
  AccessRuleAction,
  AccessRuleCreateInput,
  AccessRuleFilterInput,
  AccessRulePrincipal,
  AccessRuleStatus,
  AccessRuleUpdateInput,
  DocumentAccessRuleRecord,
} from "./types.js";
import type { AccessRuleStore } from "./access-rule.store.js";

type AccessRuleServiceStore =
  AccessRuleStore &
  Pick<AuthStore, "insertAuditLog" | "insertSecurityEvent" | "listPermissionsForUser"> &
  Pick<NomineeStore, "findNomineeById"> &
  Pick<VaultStore, "findDocumentById" | "findDocumentCategoryById" | "listDocumentCategories">;

type ScopePayload = {
  documentId: string | null;
  categoryId: string | null;
  scopeType: "DOCUMENT" | "CATEGORY";
};

async function requireCustomer(principal: AccessRulePrincipal, store: AccessRuleServiceStore) {
  assertRole(principal.user.role, ["CUSTOMER"], "Only the owning customer can manage access rules.");
  const permissions = await store.listPermissionsForUser(principal.user.id);
  assertPermission(permissions, "USER_MANAGE_ACCESS_RULE", "You are not allowed to manage access rules.");
}

async function requireAdmin(principal: AccessRulePrincipal, store: AccessRuleServiceStore) {
  assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only an administrator can view all access rules.");
  const permissions = await store.listPermissionsForUser(principal.user.id);
  assertPermission(permissions, "ADMIN_VIEW_AUDIT_LOG", "You are not allowed to view all access rules.");
}

function ruleSnapshot(rule: DocumentAccessRuleRecord) {
  return {
    id: rule.id,
    customerId: rule.customerId,
    nomineeId: rule.nomineeId,
    documentId: rule.documentId,
    categoryId: rule.categoryId,
    scopeType: rule.scopeType,
    canView: rule.canView,
    canDownload: rule.canDownload,
    releaseCondition: rule.releaseCondition,
    conditionNotes: rule.conditionNotes,
    isActive: rule.isActive,
    status: rule.status,
    revokedAt: rule.revokedAt,
    deletedAt: rule.deletedAt,
    updatedAt: rule.updatedAt,
  };
}

function buildAuditPayload(
  principal: AccessRulePrincipal,
  action: string,
  entityType: string,
  entityId: string | null,
  newValue: Record<string, unknown> | null,
  oldValue: Record<string, unknown> | null,
  context: { ipAddress: string | null; deviceInfo: string | null }
) {
  return {
    userId: principal.user.id,
    role: principal.user.role as UserRole,
    action,
    moduleName: "access-rule",
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
  };
}

function buildSecurityEvent(
  principal: AccessRulePrincipal,
  eventType: string,
  eventDescription: string,
  context: { ipAddress: string | null; deviceInfo: string | null },
  riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW"
) {
  return {
    userId: principal.user.id,
    eventType,
    eventDescription,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    riskLevel,
  };
}

function ensureBooleanConsistency(canView: boolean, canDownload: boolean) {
  if (!canView && canDownload) {
    throw new HttpError(400, "VALIDATION_ERROR", "canDownload cannot be true when canView is false.");
  }
}

function resolveScope(input: AccessRuleCreateInput | AccessRuleUpdateInput): ScopePayload {
  const documentId = "documentId" in input ? input.documentId ?? null : null;
  const categoryId = "categoryId" in input ? input.categoryId ?? null : null;
  const hasDocument = Boolean(documentId);
  const hasCategory = Boolean(categoryId);

  if (hasDocument === hasCategory) {
    throw new HttpError(400, "VALIDATION_ERROR", "Exactly one of documentId or categoryId is required.");
  }

  return {
    documentId,
    categoryId,
    scopeType: hasDocument ? "DOCUMENT" : "CATEGORY",
  };
}

function normalizeFilterStatus(value: string | null | undefined): AccessRuleStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "REVOKED" || normalized === "DELETED") {
    return normalized;
  }

  return null;
}

export function createAccessRuleService(
  env: AppEnv,
  logger: Logger,
  store: AccessRuleServiceStore
) {
  logger.debug("Access rule service initialized", { module: "access-rule", frontendOrigin: env.FRONTEND_ORIGIN });

  async function logAction(
    principal: AccessRulePrincipal,
    action: AccessRuleAction | string,
    entityId: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
    context: { ipAddress: string | null; deviceInfo: string | null },
    eventType?: string,
    eventDescription?: string
  ) {
    await store.insertAuditLog(
      buildAuditPayload(principal, action, "access_rule", entityId, newValue, oldValue, context)
    );

    await store.insertSecurityEvent(
      buildSecurityEvent(
        principal,
        eventType ?? action,
        eventDescription ?? `${action} completed successfully.`,
        context,
        "LOW"
      )
    );
  }

  async function ensureOwnedNominee(customerId: string, nomineeId: string) {
    const nominee = await store.findNomineeById(nomineeId);
    if (!nominee || nominee.customerId !== customerId || nominee.status === "REMOVED") {
      throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
    }

    return nominee;
  }

  async function ensureOwnedDocument(customerId: string, documentId: string) {
    const document = await store.findDocumentById(documentId);
    if (!document || document.customerId !== customerId) {
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    return document;
  }

  async function ensureActiveCategory(categoryId: string) {
    const category = await store.findDocumentCategoryById(categoryId);
    if (!category || !category.isActive) {
      throw new HttpError(400, "VALIDATION_ERROR", "A valid active document category is required.");
    }

    return category;
  }

  async function ensureNoDuplicateRule(
    customerId: string,
    nomineeId: string,
    scope: ScopePayload,
    excludeRuleId?: string | null
  ) {
    const existing = await store.findRuleByScope(customerId, nomineeId, scope.documentId, scope.categoryId, excludeRuleId ?? null);

    if (existing && existing.isActive) {
      throw new HttpError(409, "ACCESS_RULE_ALREADY_EXISTS", "An active access rule already exists for this nominee and scope.");
    }
  }

  async function validateCreateInput(customerId: string, input: AccessRuleCreateInput) {
    const scope = resolveScope(input);
    ensureBooleanConsistency(input.canView, input.canDownload);

    const nominee = await ensureOwnedNominee(customerId, input.nomineeId);

    if (scope.scopeType === "DOCUMENT" && scope.documentId) {
      await ensureOwnedDocument(customerId, scope.documentId);
    }

    if (scope.scopeType === "CATEGORY" && scope.categoryId) {
      await ensureActiveCategory(scope.categoryId);
    }

    await ensureNoDuplicateRule(customerId, nominee.id, scope);

    return { nominee, scope };
  }

  async function validateUpdateInput(customerId: string, rule: DocumentAccessRuleRecord, input: AccessRuleUpdateInput) {
    const nomineeId = input.nomineeId ?? rule.nomineeId;
    const scope = resolveScope({
      documentId: input.documentId ?? rule.documentId,
      categoryId: input.categoryId ?? rule.categoryId,
      canView: input.canView ?? rule.canView,
      canDownload: input.canDownload ?? rule.canDownload,
      releaseCondition: input.releaseCondition ?? rule.releaseCondition,
      conditionNotes: input.conditionNotes ?? rule.conditionNotes,
      nomineeId,
    });

    ensureBooleanConsistency(input.canView ?? rule.canView, input.canDownload ?? rule.canDownload);

    const nominee = await ensureOwnedNominee(customerId, nomineeId);

    if (scope.scopeType === "DOCUMENT" && scope.documentId) {
      await ensureOwnedDocument(customerId, scope.documentId);
    }

    if (scope.scopeType === "CATEGORY" && scope.categoryId) {
      await ensureActiveCategory(scope.categoryId);
    }

    await ensureNoDuplicateRule(customerId, nominee.id, scope, rule.id);

    return { nominee, scope };
  }

  return {
    async listAccessRules(principal: AccessRulePrincipal, filters?: AccessRuleFilterInput) {
      await requireCustomer(principal, store);
      const normalizedFilters = {
        ...filters,
        status: normalizeFilterStatus(filters?.status ?? null),
      };

      return store.listRules(principal.user.id, normalizedFilters);
    },
    async getAccessRule(principal: AccessRulePrincipal, ruleId: string) {
      await requireCustomer(principal, store);
      const rule = await store.findRuleById(ruleId);
      if (!rule || rule.customerId !== principal.user.id) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      const history = await store.listHistory(rule.id);
      return { rule, history };
    },
    async createAccessRule(
      principal: AccessRulePrincipal,
      input: AccessRuleCreateInput,
      context: { ipAddress: string | null; deviceInfo: string | null }
    ) {
      await requireCustomer(principal, store);
      const validation = await validateCreateInput(principal.user.id, input);

      const created = await store.createRule({
        customerId: principal.user.id,
        nomineeId: validation.nominee.id,
        documentId: validation.scope.documentId,
        categoryId: validation.scope.categoryId,
        canView: input.canView,
        canDownload: input.canDownload,
        releaseCondition: input.releaseCondition,
        conditionNotes: input.conditionNotes,
      });

      await store.insertRuleHistory({
        accessRuleId: created.id,
        customerId: created.customerId,
        nomineeId: created.nomineeId,
        action: "CREATED",
        performedBy: principal.user.id,
        performedRole: principal.user.role,
        oldValue: null,
        newValue: ruleSnapshot(created),
        reason: null,
      });

      await logAction(
        principal,
        "ACCESS_RULE_CREATED",
        created.id,
        null,
        ruleSnapshot(created),
        context,
        "ACCESS_RULE_CREATED",
        `Access rule created for nominee ${created.nomineeFullName}.`
      );

      return created;
    },
    async updateAccessRule(
      principal: AccessRulePrincipal,
      ruleId: string,
      input: AccessRuleUpdateInput,
      context: { ipAddress: string | null; deviceInfo: string | null }
    ) {
      await requireCustomer(principal, store);
      const current = await store.findRuleById(ruleId);
      if (!current || current.customerId !== principal.user.id) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      const validation = await validateUpdateInput(principal.user.id, current, input);
      const updated = await store.updateRule(ruleId, {
        nomineeId: validation.nominee.id,
        documentId: validation.scope.documentId,
        categoryId: validation.scope.categoryId,
        canView: input.canView ?? null,
        canDownload: input.canDownload ?? null,
        releaseCondition: input.releaseCondition ?? null,
        conditionNotes: input.conditionNotes ?? null,
      });

      if (!updated) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      await store.insertRuleHistory({
        accessRuleId: updated.id,
        customerId: updated.customerId,
        nomineeId: updated.nomineeId,
        action: "UPDATED",
        performedBy: principal.user.id,
        performedRole: principal.user.role,
        oldValue: ruleSnapshot(current),
        newValue: ruleSnapshot(updated),
        reason: null,
      });

      await logAction(
        principal,
        "ACCESS_RULE_UPDATED",
        updated.id,
        ruleSnapshot(current),
        ruleSnapshot(updated),
        context,
        "ACCESS_RULE_UPDATED",
        `Access rule updated for nominee ${updated.nomineeFullName}.`
      );

      return updated;
    },
    async revokeAccessRule(
      principal: AccessRulePrincipal,
      ruleId: string,
      context: { ipAddress: string | null; deviceInfo: string | null }
    ) {
      await requireCustomer(principal, store);
      const current = await store.findRuleById(ruleId);
      if (!current || current.customerId !== principal.user.id) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      const updated = await store.revokeRule(ruleId);
      if (!updated) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      await store.insertRuleHistory({
        accessRuleId: updated.id,
        customerId: updated.customerId,
        nomineeId: updated.nomineeId,
        action: "REVOKED",
        performedBy: principal.user.id,
        performedRole: principal.user.role,
        oldValue: ruleSnapshot(current),
        newValue: ruleSnapshot(updated),
        reason: null,
      });

      await logAction(
        principal,
        "ACCESS_RULE_REVOKED",
        updated.id,
        ruleSnapshot(current),
        ruleSnapshot(updated),
        context,
        "ACCESS_RULE_REVOKED",
        `Access rule revoked for nominee ${updated.nomineeFullName}.`
      );

      return updated;
    },
    async deleteAccessRule(
      principal: AccessRulePrincipal,
      ruleId: string,
      context: { ipAddress: string | null; deviceInfo: string | null }
    ) {
      await requireCustomer(principal, store);
      const current = await store.findRuleById(ruleId);
      if (!current || current.customerId !== principal.user.id) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      const updated = await store.deleteRule(ruleId);
      if (!updated) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      await store.insertRuleHistory({
        accessRuleId: updated.id,
        customerId: updated.customerId,
        nomineeId: updated.nomineeId,
        action: "DELETED",
        performedBy: principal.user.id,
        performedRole: principal.user.role,
        oldValue: ruleSnapshot(current),
        newValue: ruleSnapshot(updated),
        reason: null,
      });

      await logAction(
        principal,
        "ACCESS_RULE_DELETED",
        updated.id,
        ruleSnapshot(current),
        ruleSnapshot(updated),
        context,
        "ACCESS_RULE_DELETED",
        `Access rule deleted for nominee ${updated.nomineeFullName}.`
      );

      return updated;
    },
    async reactivateAccessRule(
      principal: AccessRulePrincipal,
      ruleId: string,
      context: { ipAddress: string | null; deviceInfo: string | null }
    ) {
      await requireCustomer(principal, store);
      const current = await store.findRuleById(ruleId);
      if (!current || current.customerId !== principal.user.id) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      await ensureNoDuplicateRule(current.customerId, current.nomineeId, {
        documentId: current.documentId,
        categoryId: current.categoryId,
        scopeType: current.scopeType,
      }, current.id);

      const updated = await store.reactivateRule(ruleId);
      if (!updated) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      await store.insertRuleHistory({
        accessRuleId: updated.id,
        customerId: updated.customerId,
        nomineeId: updated.nomineeId,
        action: "REACTIVATED",
        performedBy: principal.user.id,
        performedRole: principal.user.role,
        oldValue: ruleSnapshot(current),
        newValue: ruleSnapshot(updated),
        reason: null,
      });

      await logAction(
        principal,
        "ACCESS_RULE_REACTIVATED",
        updated.id,
        ruleSnapshot(current),
        ruleSnapshot(updated),
        context,
        "ACCESS_RULE_REACTIVATED",
        `Access rule reactivated for nominee ${updated.nomineeFullName}.`
      );

      return updated;
    },
    async listAdminAccessRules(principal: AccessRulePrincipal, filters?: AccessRuleFilterInput) {
      await requireAdmin(principal, store);
      const normalizedFilters = {
        ...filters,
        status: normalizeFilterStatus(filters?.status ?? null),
      };

      return store.listRules(null, normalizedFilters);
    },
    async getAccessRuleHistory(principal: AccessRulePrincipal, ruleId: string) {
      await requireCustomer(principal, store);
      const rule = await store.findRuleById(ruleId);
      if (!rule || rule.customerId !== principal.user.id) {
        throw new HttpError(404, "ACCESS_RULE_NOT_FOUND", "Access rule not found.");
      }

      return store.listHistory(ruleId);
    },
  };
}

export type AccessRuleService = ReturnType<typeof createAccessRuleService>;
