import { randomUUID } from "node:crypto";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { HttpError } from "../../utils/http.js";
import { assertPermission, assertRole } from "../rbac/rbac.guard.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext, UserRole } from "../auth/types.js";
import type { AccessRuleStore } from "../access-rule/access-rule.store.js";
import { createTriggerProofSigner, buildTriggerProofStorageKey } from "./s3.js";
import { createS3Signer, type S3Signer } from "../vault/s3.js";
import type { VaultStore } from "../vault/vault.store.js";
import type { ReleaseStore } from "../release/release.store.js";
import type {
  TriggerActorRole,
  TriggerEligibleDocumentRecord,
  TriggerProofCreateInput,
  TriggerProofRecord,
  TriggerPrincipal,
  TriggerDocumentPreviewTicket,
  TriggerRequestCreateInput,
  TriggerRequestKind,
  TriggerRequestPriority,
  TriggerRequestRecord,
  TriggerRequestStatus,
  TriggerTimelineEntry,
  TriggerUploadTicket,
} from "./types.js";
import type { TriggerStore } from "./trigger.store.js";

type TriggerServiceStore = TriggerStore &
  Pick<
    AuthStore,
    | "findUserById"
    | "findNomineeAssignment"
    | "insertAuditLog"
    | "insertSecurityEvent"
    | "createNotification"
    | "listPermissionsForUser"
  > &
  Pick<AccessRuleStore, "listRules"> &
  Pick<VaultStore, "listDocuments" | "findDocumentById"> &
  Pick<ReleaseStore, "findReleaseByComposite" | "upsertRelease">;

function toTriggerActorRole(role: UserRole): TriggerActorRole {
  if (role === "CUSTOMER") {
    return "customer";
  }

  if (role === "NOMINEE") {
    return "nominee";
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "admin";
  }

  return "system";
}

function isRequestKind(value: string): value is TriggerRequestKind {
  return ["death", "medical", "legal", "court-order", "other", "document-access"].includes(value);
}

function isPriority(value: string): value is TriggerRequestPriority {
  return ["Low", "Medium", "High", "Critical"].includes(value);
}

function isStatus(value: string): value is TriggerRequestStatus {
  return [
    "DRAFT",
    "PENDING",
    "UNDER_REVIEW",
    "ADDITIONAL_INFO_REQUIRED",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
  ].includes(value);
}

function buildAudit(
  principal: TriggerPrincipal,
  action: string,
  entityType: string,
  entityId: string | null,
  newValue: Record<string, unknown> | null,
  oldValue: Record<string, unknown> | null,
  context: AuthRequestContext
) {
  return {
    userId: principal.user.id,
    role: principal.user.role,
    action,
    moduleName: "trigger",
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
  };
}

function buildSecurityEvent(
  principal: TriggerPrincipal,
  eventType: string,
  eventDescription: string,
  context: AuthRequestContext,
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

function buildNotificationMetadata(input: {
  category: "workflow" | "security" | "release" | "compliance";
  priority: "low" | "medium" | "high";
  source: string;
  actionLabel: string;
  requestId: string;
  requestKind?: TriggerRequestKind;
}) {
  return {
    category: input.category,
    priority: input.priority,
    source: input.source,
    actionLabel: input.actionLabel,
    requestId: input.requestId,
    requestKind: input.requestKind ?? null,
  };
}

export function createTriggerService(
  env: AppEnv,
  logger: Logger,
  store: TriggerServiceStore,
  signer: S3Signer | null = null
) {
  logger.debug("Trigger service initialized", { module: "trigger" });
  let signerInstance = signer;

  async function logSensitiveAction(
    principal: TriggerPrincipal,
    action: string,
    entityType: string,
    entityId: string | null,
    newValue: Record<string, unknown> | null,
    oldValue: Record<string, unknown> | null,
    context: AuthRequestContext,
    riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW"
  ) {
    await store.insertAuditLog(buildAudit(principal, action, entityType, entityId, newValue, oldValue, context));
    await store.insertSecurityEvent(
      buildSecurityEvent(
        principal,
        action,
        `${action.replaceAll("_", " ").toLowerCase()} completed successfully.`,
        context,
        riskLevel
      )
    );
  }

  async function notifyRequestParticipants(
    request: TriggerRequestRecord,
    options: {
      title: string;
      message: string;
      category: "workflow" | "security" | "release";
      priority: "low" | "medium" | "high";
      actionLabel: string;
      source: string;
    }
  ) {
    const recipients = new Set<string>([request.customerId]);
    if (request.nomineeUserId) {
      recipients.add(request.nomineeUserId);
    }

    await Promise.all(
      [...recipients].map((userId) =>
        store.createNotification({
          userId,
          title: options.title,
          message: options.message,
          channel: "IN_APP",
          status: "SENT",
          metadata: buildNotificationMetadata({
            category: options.category,
            priority: options.priority,
            source: options.source,
            actionLabel: options.actionLabel,
            requestId: request.id,
            requestKind: request.requestKind,
          }),
        })
      )
    );
  }

  async function ensureNomineeScope(principal: TriggerPrincipal, nomineeId?: string | null) {
    if (principal.user.role === "CUSTOMER") {
      if (!nomineeId) {
        throw new HttpError(400, "VALIDATION_ERROR", "nomineeId is required for customer-initiated trigger requests.");
      }

      const nominee = await store.findNomineeById(nomineeId);
      if (!nominee || nominee.customerId !== principal.user.id || nominee.status === "REMOVED") {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
      }

      return nominee;
    }

    if (principal.user.role === "NOMINEE") {
      const nominee = nomineeId
        ? await store.findNomineeById(nomineeId)
        : await store.findNomineeByUserId(principal.user.id);

      if (!nominee || nominee.nomineeUserId !== principal.user.id || nominee.status === "REMOVED") {
        throw new HttpError(403, "FORBIDDEN", "No nominee assignment exists for this account.");
      }

      return nominee;
    }

    throw new HttpError(403, "FORBIDDEN", "Only customers and nominees can create trigger requests.");
  }

  async function ensureEligibleNominee(principal: TriggerPrincipal) {
    if (principal.user.role !== "NOMINEE") {
      throw new HttpError(403, "FORBIDDEN", "Only nominees can view eligible documents.");
    }

    const nominee = await store.findNomineeByUserId(principal.user.id);
    if (!nominee || nominee.status === "REMOVED") {
      throw new HttpError(404, "NOMINEE_NOT_FOUND", "No nominee assignment exists for this account.");
    }

    return nominee;
  }

function pickBestAccessRule(
    rules: Array<{
      id: string;
      documentId: string | null;
      categoryId: string | null;
      canView: boolean;
      canDownload: boolean;
      releaseCondition: string;
      conditionNotes: string | null;
    }>,
    documentId: string,
    categoryId: string
) {
  return rules.find((rule) => rule.documentId === documentId) ?? rules.find((rule) => rule.categoryId === categoryId) ?? null;
}

function normalizeRulePermissions(rule: { canView: boolean; canDownload: boolean }) {
  const canView = Boolean(rule.canView);
  return {
    canView,
    canDownload: canView && Boolean(rule.canDownload),
  };
}

function releaseSnapshot(release: {
  id: string;
  triggerRequestId: string;
  customerId: string;
  nomineeId: string;
  documentId: string;
  releaseStatus: string;
  canView: boolean;
  canDownload: boolean;
  releaseNotes: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: release.id,
    triggerRequestId: release.triggerRequestId,
    customerId: release.customerId,
    nomineeId: release.nomineeId,
    documentId: release.documentId,
    releaseStatus: release.releaseStatus,
    canView: release.canView,
    canDownload: release.canDownload,
    releaseNotes: release.releaseNotes,
    releasedAt: release.releasedAt,
    revokedAt: release.revokedAt,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
  };
}

  async function listEligibleDocumentsForNominee(principal: TriggerPrincipal): Promise<TriggerEligibleDocumentRecord[]> {
    const nominee = await ensureEligibleNominee(principal);
    const [rules, documents] = await Promise.all([
      store.listRules(nominee.customerId, { nomineeId: nominee.id, status: "ACTIVE" }),
      store.listDocuments(nominee.customerId),
    ]);

    const eligibleDocuments = documents.reduce<TriggerEligibleDocumentRecord[]>((accumulator, document) => {
      if (document.status !== "ACTIVE") {
        return accumulator;
      }

      const matchedRule = pickBestAccessRule(
        rules.map((rule) => ({
          id: rule.id,
          documentId: rule.documentId,
          categoryId: rule.categoryId,
          canView: rule.canView,
          canDownload: rule.canDownload,
          releaseCondition: rule.releaseCondition,
          conditionNotes: rule.conditionNotes,
        })),
        document.id,
        document.categoryId
      );

      if (!matchedRule) {
        return accumulator;
      }

      const permissions = normalizeRulePermissions(matchedRule);

      accumulator.push({
        documentId: document.id,
        documentTitle: document.documentTitle,
        fileName: document.originalFileName,
        fileType: document.fileMimeType,
        fileSize: document.fileSize,
        categoryId: document.categoryId,
        categoryName: document.categoryName,
        canView: permissions.canView,
        canDownload: permissions.canDownload,
        releaseCondition: matchedRule?.releaseCondition ?? null,
        conditionNotes: matchedRule?.conditionNotes ?? null,
        requestId: null,
        requestStatus: null,
        requestKind: null,
        proofCount: 0,
        latestProofStatus: null,
        latestProofAt: null,
        releaseId: null,
        releaseStatus: null,
        releaseNotes: null,
        releasedAt: null,
        revokedAt: null,
        latestActivityAt: document.updatedAt,
      });

      return accumulator;
    }, []);

    const eligibleWithWorkflow = await Promise.all(
      eligibleDocuments.map(async (document) => {
        const requests = await store.listRequestsByNomineeUserId(principal.user.id, {
          requestKind: "document-access",
          documentId: document.documentId,
        });
        const latestRequest = requests[0] ?? null;

        if (!latestRequest) {
          return document;
        }

        const proofs = await store.listProofs(latestRequest.id);
        const release = await store.findReleaseByComposite({
          triggerRequestId: latestRequest.id,
          documentId: document.documentId,
          nomineeId: nominee.id,
        });

        return {
          ...document,
          requestId: latestRequest.id,
          requestStatus: latestRequest.status,
          requestKind: latestRequest.requestKind,
          proofCount: proofs.length,
          latestProofStatus: proofs[0]?.verificationStatus ?? null,
          latestProofAt: proofs[0]?.createdAt ?? null,
          releaseId: release?.id ?? null,
          releaseStatus: release?.releaseStatus ?? null,
          releaseNotes: release?.releaseNotes ?? null,
          releasedAt: release?.releasedAt ?? null,
          revokedAt: release?.revokedAt ?? null,
          latestActivityAt:
            [latestRequest.latestActivityAt, release?.updatedAt ?? null, document.latestActivityAt]
              .filter((value): value is string => Boolean(value))
              .sort()
              .pop() ?? document.latestActivityAt,
        };
      })
    );

    return eligibleWithWorkflow.sort((left, right) => left.documentTitle.localeCompare(right.documentTitle));
  }

  async function ensureDocumentAccessEligibility(principal: TriggerPrincipal, documentId: string) {
    const nominee = await ensureNomineeScope(principal, null);
    const documents = await store.listDocuments(nominee.customerId);
    const document = documents.find((item) => item.id === documentId);
    if (!document || document.status !== "ACTIVE") {
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    const rules = await store.listRules(nominee.customerId, { nomineeId: nominee.id, status: "ACTIVE" });
    const matchedRule = pickBestAccessRule(
      rules.map((rule) => ({
        id: rule.id,
        documentId: rule.documentId,
        categoryId: rule.categoryId,
        canView: rule.canView,
        canDownload: rule.canDownload,
        releaseCondition: rule.releaseCondition,
        conditionNotes: rule.conditionNotes,
      })),
      document.id,
      document.categoryId
    );

    if (!matchedRule) {
      throw new HttpError(403, "DOCUMENT_NOT_ELIGIBLE", "This document is not eligible for nominee access requests.");
    }

    return { nominee, document, matchedRule };
  }

  async function createOrRefreshDocumentAccessRelease(
    principal: TriggerPrincipal,
    request: TriggerRequestRecord,
    context: AuthRequestContext,
    releaseNotes: string | null
  ) {
    if (request.requestKind !== "document-access" || !request.documentId) {
      return null;
    }

    const nominee = await store.findNomineeById(request.nomineeId);
    if (!nominee || nominee.status === "REMOVED") {
      throw new HttpError(409, "DOCUMENT_RELEASE_NOT_ELIGIBLE", "The nominee release could not be created for this request.");
    }

    const documents = await store.listDocuments(request.customerId);
    const document = documents.find((item) => item.id === request.documentId && item.status === "ACTIVE");
    if (!document) {
      throw new HttpError(409, "DOCUMENT_RELEASE_NOT_ELIGIBLE", "The nominee release could not be created for this request.");
    }

    const rules = await store.listRules(request.customerId, { nomineeId: nominee.id, status: "ACTIVE" });
    const matchedRule = pickBestAccessRule(
      rules.map((rule) => ({
        id: rule.id,
        documentId: rule.documentId,
        categoryId: rule.categoryId,
        canView: rule.canView,
        canDownload: rule.canDownload,
        releaseCondition: rule.releaseCondition,
        conditionNotes: rule.conditionNotes,
      })),
      document.id,
      document.categoryId
    );

    if (!matchedRule) {
      throw new HttpError(409, "DOCUMENT_RELEASE_NOT_ELIGIBLE", "The nominee release could not be created for this request.");
    }

    const permissions = normalizeRulePermissions(matchedRule);

    const existingRelease = await store.findReleaseByComposite({
      triggerRequestId: request.id,
      nomineeId: nominee.id,
      documentId: document.id,
    });

    logger.debug("Creating or refreshing document-access release", {
      requestId: request.id,
      requestKind: request.requestKind,
      nomineeId: nominee.id,
      nomineeUserId: nominee.nomineeUserId,
      documentId: document.id,
      existingReleaseId: existingRelease?.id ?? null,
      matchedRule: {
        canView: permissions.canView,
        canDownload: permissions.canDownload,
      },
    });

    const release = await store.upsertRelease({
      triggerRequestId: request.id,
      customerId: request.customerId,
      nomineeId: nominee.id,
      documentId: document.id,
      releasedBy: principal.user.id,
      canView: permissions.canView,
      canDownload: permissions.canDownload,
      releaseNotes: releaseNotes?.trim() || matchedRule.conditionNotes || null,
    });

    logger.debug("Document-access release created or refreshed", {
      releaseId: release.id,
      requestId: request.id,
      nomineeId: release.nomineeId,
      nomineeUserId: release.nomineeUserId,
      documentId: release.documentId,
      releaseStatus: release.releaseStatus,
      canView: release.canView,
      canDownload: release.canDownload,
    });

    await logSensitiveAction(
      principal,
      existingRelease ? "DOCUMENT_RELEASE_UPDATED" : "DOCUMENT_RELEASE_CREATED",
      "document_release",
      release.id,
      {
        releaseId: release.id,
        triggerRequestId: release.triggerRequestId,
        documentId: release.documentId,
        nomineeId: release.nomineeId,
        releaseStatus: release.releaseStatus,
        canView: release.canView,
        canDownload: release.canDownload,
      },
      null,
      context,
      "MEDIUM"
    );

    await Promise.all([
      store.createNotification({
        userId: request.customerId,
        title: "Document released",
        message: `${document.documentTitle} is now available through controlled release for ${nominee.fullName}.`,
        channel: "IN_APP",
        status: "SENT",
        metadata: {
          category: "release",
          priority: "high",
          source: "Trigger workflow",
          actionLabel: "Review release",
          requestId: request.id,
          requestKind: request.requestKind,
          documentId: document.id,
          releaseId: release.id,
        },
      }),
      store.createNotification({
        userId: nominee.nomineeUserId ?? request.customerId,
        title: "Document access approved",
        message: `${document.documentTitle} is ready for approved access.`,
        channel: "IN_APP",
        status: "SENT",
        metadata: {
          category: "release",
          priority: "high",
          source: "Trigger workflow",
          actionLabel: "Open approved access",
          requestId: request.id,
          requestKind: request.requestKind,
          documentId: document.id,
          releaseId: release.id,
        },
      }),
    ]);

    return release;
  }

  async function finalizeApprovedDocumentAccessRequest(
    principal: TriggerPrincipal,
    request: TriggerRequestRecord,
    context: AuthRequestContext,
    adminRemarks: string | null
  ) {
    const updated = await store.updateRequestReview(
      request.id,
      "APPROVED",
      principal.user.id,
      toTriggerActorRole(principal.user.role),
      adminRemarks
    );
    if (!updated) {
      throw new HttpError(500, "TRIGGER_REQUEST_UPDATE_FAILED", "Trigger request status could not be updated.");
    }

    await logSensitiveAction(
      principal,
      "TRIGGER_REQUEST_APPROVED",
      "trigger_request",
      updated.id,
      requestSnapshot(updated),
      requestSnapshot(request),
      context,
      "MEDIUM"
    );

    const release = await createOrRefreshDocumentAccessRelease(principal, updated, context, adminRemarks);

    await notifyRequestParticipants(updated, {
      title: "Trigger request approved",
      message: `${updated.subjectLine} has been approved for controlled release.`,
      category: "release",
      priority: "high",
      actionLabel: "Open release center",
      source: "Release review",
    });

    return { request: updated, release };
  }

  async function ensureRequestScope(principal: TriggerPrincipal, request: TriggerRequestRecord) {
    if (principal.user.role === "ADMIN" || principal.user.role === "SUPER_ADMIN") {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "ADMIN_VIEW_TRIGGER_QUEUE", "You are not allowed to view trigger requests.");
      return request;
    }

    if (principal.user.role === "VERIFICATION_OFFICER") {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "VERIFICATION_VIEW_ASSIGNED_CASE", "You are not allowed to view trigger requests.");
      return request;
    }

    if (principal.user.role === "CUSTOMER") {
      assertRole(principal.user.role, ["CUSTOMER"], "Only the owning customer can view this trigger request.");
      if (request.customerId !== principal.user.id) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }
      return request;
    }

    if (principal.user.role === "NOMINEE") {
      assertRole(principal.user.role, ["NOMINEE"], "Only the assigned nominee can view this trigger request.");
      if (request.nomineeUserId !== principal.user.id) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }
      return request;
    }

    throw new HttpError(403, "FORBIDDEN", "Access is denied.");
  }

  async function assertCreatePermissions(principal: TriggerPrincipal) {
    if (principal.user.role === "NOMINEE") {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "NOMINEE_RAISE_TRIGGER", "You are not allowed to raise a trigger request.");
    }
  }

  async function assertProofPermissions(principal: TriggerPrincipal) {
    if (principal.user.role === "NOMINEE") {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "NOMINEE_UPLOAD_PROOF", "You are not allowed to upload proof for this request.");
    }
  }

  async function assertProofReviewPermissions(principal: TriggerPrincipal) {
    const permissions = await store.listPermissionsForUser(principal.user.id);

    if (principal.user.role === "VERIFICATION_OFFICER") {
      assertPermission(permissions, "VERIFICATION_REVIEW_PROOF", "You are not allowed to review proof for this request.");
      return;
    }

    if (principal.user.role === "ADMIN" || principal.user.role === "SUPER_ADMIN") {
      assertPermission(permissions, "ADMIN_VERIFY_PROOF", "You are not allowed to verify proof for this request.");
      return;
    }

    throw new HttpError(403, "FORBIDDEN", "Only verification officers and admins can review proof.");
  }

  async function assertTriggerDecisionPermissions(principal: TriggerPrincipal, action: "approve" | "reject") {
    const permissions = await store.listPermissionsForUser(principal.user.id);

    if (principal.user.role === "VERIFICATION_OFFICER") {
      assertPermission(permissions, "VERIFICATION_REVIEW_PROOF", "You are not allowed to review trigger requests.");
      return;
    }

    if (action === "approve") {
      assertPermission(permissions, "ADMIN_APPROVE_TRIGGER", "You are not allowed to approve trigger requests.");
    } else {
      assertPermission(permissions, "ADMIN_REJECT_TRIGGER", "You are not allowed to reject trigger requests.");
    }
  }

  function ensureDecisionRole(principal: TriggerPrincipal) {
    if (principal.user.role !== "VERIFICATION_OFFICER" && principal.user.role !== "ADMIN" && principal.user.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "FORBIDDEN", "Only verification officers and admins can perform this action.");
    }
  }

  async function ensureAdminReviewScope(principal: TriggerPrincipal, request: TriggerRequestRecord) {
    if (principal.user.role === "ADMIN" || principal.user.role === "SUPER_ADMIN") {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "ADMIN_VIEW_TRIGGER_QUEUE", "You are not allowed to review trigger requests.");
      return request;
    }

    if (principal.user.role === "VERIFICATION_OFFICER") {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "VERIFICATION_VIEW_ASSIGNED_CASE", "You are not allowed to review trigger requests.");
      return request;
    }

    throw new HttpError(403, "FORBIDDEN", "Only verification officers and admins can review trigger requests.");
  }

  async function getRequestedDocumentPreview(
    principal: TriggerPrincipal,
    requestId: string,
    context: AuthRequestContext
  ): Promise<TriggerDocumentPreviewTicket> {
    const request = await store.findRequestById(requestId);
    if (!request) {
      throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
    }

    await ensureAdminReviewScope(principal, request);

    if (!request.documentId) {
      throw new HttpError(409, "TRIGGER_REQUEST_NOT_DOCUMENT_LINKED", "This trigger request does not link to a customer document.");
    }

    const document = await store.findDocumentById(request.documentId);
    if (!document || document.customerId !== request.customerId || document.status !== "ACTIVE") {
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    const vaultSigner = createS3Signer(env);
    const preview = vaultSigner.signGetObject(document.encryptedFilePath, document.originalFileName, "inline");

    await logSensitiveAction(
      principal,
      "TRIGGER_REQUEST_DOCUMENT_PREVIEW_ISSUED",
      "trigger_request",
      request.id,
      {
        requestId: request.id,
        documentId: document.id,
        documentTitle: document.documentTitle,
        previewUrlIssued: true,
        expiresAt: preview.expiresAt,
      },
      null,
      context,
      "MEDIUM"
    );

    return {
      document: {
        documentId: document.id,
        documentTitle: document.documentTitle,
        fileName: document.originalFileName,
        fileType: document.fileMimeType,
        fileSize: document.fileSize,
      },
      preview,
    };
  }

  async function assertReviewPermission(principal: TriggerPrincipal, permissionKey: string, message: string) {
    const permissions = await store.listPermissionsForUser(principal.user.id);
    assertPermission(permissions, permissionKey as Parameters<typeof assertPermission>[1], message);
  }

  function getSigner() {
    if (!signerInstance) {
      signerInstance = createTriggerProofSigner(env);
    }

    return signerInstance;
  }

  function isOpenRequestStatus(status: TriggerRequestStatus) {
    return status === "DRAFT" || status === "PENDING" || status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED";
  }

  function requestSnapshot(request: TriggerRequestRecord) {
  return {
    id: request.id,
    customerId: request.customerId,
    customerName: request.customerName,
    nomineeId: request.nomineeId,
    nomineeName: request.nomineeName,
    nomineeEmail: request.nomineeEmail,
    nomineeMobile: request.nomineeMobile,
    relationship: request.relationship,
    customRelationship: request.customRelationship,
    documentId: request.documentId,
    documentTitle: request.documentTitle,
    accessRuleId: request.accessRuleId,
    accessRuleScope: request.accessRuleScope,
    accessRuleCanView: request.accessRuleCanView,
    accessRuleCanDownload: request.accessRuleCanDownload,
    accessRuleCondition: request.accessRuleCondition,
    accessRuleNotes: request.accessRuleNotes,
    requestKind: request.requestKind,
    subjectLine: request.subjectLine,
    summary: request.summary,
    priority: request.priority,
      status: request.status,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      resolvedAt: request.resolvedAt,
      cancelledAt: request.cancelledAt,
      additionalInfoRequestedAt: request.additionalInfoRequestedAt,
      additionalInfoReason: request.additionalInfoReason,
      adminDecisionNote: request.adminDecisionNote,
      latestActivityAt: request.latestActivityAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      proofCount: 0,
      requestedByUserId: request.requestedByUserId,
      lastActionBy: request.lastActionByName,
      lastActionRole: request.lastActionRole,
    };
  }

  function proofSnapshot(proof: TriggerProofRecord) {
    return {
      id: proof.id,
      requestId: proof.requestId,
      fileName: proof.fileName,
      fileType: proof.fileType,
      fileSize: proof.fileSize,
      fileHash: proof.fileHash,
      notes: proof.notes,
      uploadedBy: proof.uploadedBy,
      uploadedByRole: proof.uploadedByRole,
      verificationStatus: proof.verificationStatus,
      adminRemarks: proof.adminRemarks,
      createdAt: proof.createdAt,
    };
  }

  async function enrichRequest(request: TriggerRequestRecord) {
    const proofs = await store.listProofs(request.id);
    const timeline = await store.listTimeline(request.id);

    return {
      ...requestSnapshot(request),
      proofCount: proofs.length,
      latestProofId: proofs[0]?.id ?? null,
      proofs: proofs.map((proof) => proofSnapshot(proof)),
      timeline,
    };
  }

  function buildUploadTicket(
    uploadPath: string,
    fileType: string,
    fileName: string | null
  ): TriggerUploadTicket["upload"] {
    const signed = getSigner().signPutObject(uploadPath, fileType);
    if (fileName) {
      return {
        url: signed.url,
        expiresAt: signed.expiresAt,
        requiredHeaders: signed.requiredHeaders,
      };
    }

    return signed;
  }

  return {
    async listTriggerRequests(
      principal: TriggerPrincipal,
      filters?: { status?: TriggerRequestStatus | null; requestKind?: TriggerRequestKind | null; documentId?: string | null }
    ) {
      const status = filters?.status && isStatus(filters.status) ? filters.status : null;
      const requestKind = filters?.requestKind && isRequestKind(filters.requestKind) ? filters.requestKind : null;
      const documentId = filters?.documentId?.trim() || null;

      if (principal.user.role === "CUSTOMER") {
        return store.listRequestsByCustomer(principal.user.id, { status, requestKind, documentId });
      }

      if (principal.user.role === "NOMINEE") {
        return store.listRequestsByNomineeUserId(principal.user.id, { status, requestKind, documentId });
      }

      if (principal.user.role === "ADMIN" || principal.user.role === "SUPER_ADMIN") {
        const permissions = await store.listPermissionsForUser(principal.user.id);
        assertPermission(permissions, "ADMIN_VIEW_TRIGGER_QUEUE", "You are not allowed to view trigger requests.");
        return store.listRequestsForAdmin({ status, requestKind, documentId });
      }

      if (principal.user.role === "VERIFICATION_OFFICER") {
        const permissions = await store.listPermissionsForUser(principal.user.id);
        assertPermission(permissions, "VERIFICATION_VIEW_ASSIGNED_CASE", "You are not allowed to view trigger requests.");
        return store.listRequestsForAdmin({ status, requestKind, documentId });
      }

      throw new HttpError(403, "FORBIDDEN", "Access is denied.");
    },
    async getTriggerRequest(principal: TriggerPrincipal, requestId: string) {
      let request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      await ensureRequestScope(principal, request);
      return enrichRequest(request);
    },
    async createTriggerRequest(
      principal: TriggerPrincipal,
      input: TriggerRequestCreateInput,
      context: AuthRequestContext
    ) {
      assertRole(principal.user.role, ["CUSTOMER", "NOMINEE"], "Only customers and nominees can create trigger requests.");
      await assertCreatePermissions(principal);

      if (!isRequestKind(input.requestKind)) {
        throw new HttpError(400, "VALIDATION_ERROR", "A valid trigger request kind is required.");
      }

      if (!isPriority(input.priority)) {
        throw new HttpError(400, "VALIDATION_ERROR", "A valid trigger priority is required.");
      }

      if (!input.subjectLine.trim() || !input.summary.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "subjectLine and summary are required.");
      }

      if (input.requestKind === "document-access" && principal.user.role !== "NOMINEE") {
        throw new HttpError(403, "FORBIDDEN", "Only nominees can request access to a specific document.");
      }

      const nominee =
        input.requestKind === "document-access" ? await ensureEligibleNominee(principal) : await ensureNomineeScope(principal, input.nomineeId ?? null);

      const scopedRequests =
        principal.user.role === "CUSTOMER"
          ? await store.listRequestsByCustomer(principal.user.id)
          : await store.listRequestsByNomineeUserId(principal.user.id);

      const isDocumentAccessDuplicate =
        input.requestKind === "document-access"
          ? scopedRequests.some(
              (existing) =>
                existing.nomineeId === nominee.id &&
                existing.requestKind === "document-access" &&
                existing.documentId === input.documentId &&
                isOpenRequestStatus(existing.status)
            )
          : false;

      const hasAnyOpenRequest =
        input.requestKind === "document-access"
          ? false
          : scopedRequests.some((existing) => existing.nomineeId === nominee.id && isOpenRequestStatus(existing.status));

      if (isDocumentAccessDuplicate || hasAnyOpenRequest) {
        throw new HttpError(409, "TRIGGER_REQUEST_ALREADY_OPEN", "An open trigger request already exists for this nominee.");
      }

      let eligibleDocumentId: string | null = null;
      if (input.requestKind === "document-access") {
        if (!input.documentId) {
          throw new HttpError(400, "VALIDATION_ERROR", "documentId is required for document access requests.");
        }

        const eligibility = await ensureDocumentAccessEligibility(principal, input.documentId);
        eligibleDocumentId = eligibility.document.id;
      }

      const created = await store.createRequest({
        customerId: nominee.customerId,
        nomineeId: nominee.id,
        documentId: eligibleDocumentId,
        requestKind: input.requestKind,
        subjectLine: input.subjectLine.trim(),
        summary: input.summary.trim(),
        priority: input.priority,
        requestedByUserId: principal.user.id,
        requestedByRole: principal.user.role,
      });

      await logSensitiveAction(
        principal,
        "TRIGGER_REQUEST_CREATED",
        "trigger_request",
        created.id,
        requestSnapshot(created),
        null,
        context
      );

      await notifyRequestParticipants(created, {
        title: "Trigger request created",
        message: `${created.subjectLine} is awaiting review.`,
        category: "workflow",
        priority: "medium",
        actionLabel: "Open request",
        source: "Trigger workflow",
      });

      return enrichRequest(created);
    },
    async listEligibleDocuments(principal: TriggerPrincipal) {
      return listEligibleDocumentsForNominee(principal);
    },
    async getTriggerRequestedDocumentPreview(principal: TriggerPrincipal, requestId: string, context: AuthRequestContext) {
      return getRequestedDocumentPreview(principal, requestId, context);
    },
    async submitTriggerRequest(principal: TriggerPrincipal, requestId: string, context: AuthRequestContext) {
      assertRole(principal.user.role, ["CUSTOMER", "NOMINEE"], "Only customers and nominees can submit trigger requests.");
      let request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      await ensureRequestScope(principal, request);

      if (request.status !== "DRAFT" && request.status !== "PENDING") {
        throw new HttpError(409, "TRIGGER_REQUEST_NOT_SUBMITTABLE", "Only draft trigger requests can be submitted.");
      }

      const updated = await store.submitRequest(requestId, principal.user.id, toTriggerActorRole(principal.user.role));
      if (!updated) {
        throw new HttpError(409, "TRIGGER_REQUEST_NOT_SUBMITTABLE", "Only draft trigger requests can be submitted.");
      }

      await logSensitiveAction(
        principal,
        "TRIGGER_REQUEST_SUBMITTED",
        "trigger_request",
        updated.id,
        requestSnapshot(updated),
        requestSnapshot(request),
        context
      );

      await notifyRequestParticipants(updated, {
        title: "Trigger request submitted",
        message: `${updated.subjectLine} is now in the review queue.`,
        category: "workflow",
        priority: "medium",
        actionLabel: "View review",
        source: "Trigger workflow",
      });

      return enrichRequest(updated);
    },
    async listTriggerProofs(principal: TriggerPrincipal, requestId: string) {
      let request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      await ensureRequestScope(principal, request);
      const proofs = await store.listProofs(requestId);
      return proofs.map((proof) => proofSnapshot(proof));
    },
    async getTriggerProofDownload(
      principal: TriggerPrincipal,
      requestId: string,
      proofId: string,
      context: AuthRequestContext
    ) {
      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      await ensureRequestScope(principal, request);

      const proofRecord = await store.findProofById(requestId, proofId);
      if (!proofRecord) {
        throw new HttpError(404, "TRIGGER_PROOF_NOT_FOUND", "Proof not found.");
      }

      const signerInstance = getSigner();
      const download = signerInstance.signGetObject(proofRecord.encryptedFilePath, proofRecord.originalFileName ?? null, "inline");

      await logSensitiveAction(
        principal,
        "TRIGGER_PROOF_DOWNLOAD_ISSUED",
        "trigger_proof",
        proofId,
        { proofId, requestId, downloadUrlIssued: true },
        null,
        context,
        "LOW"
      );

      return { download };
    },
    async deleteUnreviewedTriggerProof(
      principal: TriggerPrincipal,
      requestId: string,
      proofId: string,
      context: AuthRequestContext
    ) {
      assertRole(principal.user.role, ["CUSTOMER", "NOMINEE"], "Only customers and nominees can remove an unreviewed proof upload.");

      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      await ensureRequestScope(principal, request);

      const deleted = await store.deleteUnreviewedProof(requestId, proofId);
      if (!deleted) {
        throw new HttpError(404, "TRIGGER_PROOF_NOT_FOUND", "Unreviewed proof not found.");
      }

      await getSigner().signDeleteObject(deleted.encryptedFilePath).catch(() => undefined);

      await logSensitiveAction(
        principal,
        "TRIGGER_PROOF_UPLOAD_CANCELLED",
        "trigger_proof",
        proofId,
        { proofId, requestId },
        null,
        context,
        "LOW"
      );

      return enrichRequest(request);
    },
    async createProofUpload(
      principal: TriggerPrincipal,
      input: TriggerProofCreateInput,
      context: AuthRequestContext
    ): Promise<TriggerUploadTicket> {
      assertRole(principal.user.role, ["CUSTOMER", "NOMINEE"], "Only customers and nominees can upload proof.");
      await assertProofPermissions(principal);

      if (!input.fileName.trim() || !input.fileType.trim() || !Number.isFinite(input.fileSize) || input.fileSize <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "fileName, fileType, and fileSize are required.");
      }

      const request = await store.findRequestById(input.requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      await ensureRequestScope(principal, request);

      if (request.status === "APPROVED" || request.status === "REJECTED" || request.status === "CANCELLED") {
        throw new HttpError(409, "TRIGGER_REQUEST_CLOSED", "Files cannot be added to a closed trigger request.");
      }

      const proofId = randomUUID();
      const uploadPath = buildTriggerProofStorageKey(request.customerId, request.id, proofId, input.fileName);
      const proof = await store.createProof({
        triggerRequestId: request.id,
        uploadedByUserId: principal.user.id,
        uploadedByRole: principal.user.role,
        fileName: input.fileName.trim(),
        fileMimeType: input.fileType.trim(),
        fileSize: input.fileSize,
        fileHash: input.fileHash ?? null,
        notes: input.notes?.trim() ?? null,
        encryptedFilePath: uploadPath,
      });

      const nextStatus: TriggerRequestStatus =
        request.status === "DRAFT" || request.status === "PENDING" || request.status === "ADDITIONAL_INFO_REQUIRED"
          ? "UNDER_REVIEW"
          : request.status;

      const updatedRequest = await store.updateRequestStatus(
        request.id,
        nextStatus,
        principal.user.id,
        toTriggerActorRole(principal.user.role)
      );
      if (!updatedRequest) {
        throw new HttpError(500, "TRIGGER_REQUEST_UPDATE_FAILED", "Trigger request status could not be updated.");
      }

      await logSensitiveAction(
        principal,
        "TRIGGER_PROOF_UPLOADED",
        "trigger_proof",
        proof.id,
        proofSnapshot(proof),
        null,
        context,
        "MEDIUM"
      );

      await notifyRequestParticipants(updatedRequest, {
        title: "Proof uploaded",
        message: `${updatedRequest.subjectLine} received a new proof upload.`,
        category: "workflow",
        priority: "medium",
        actionLabel: "Review proof",
        source: "Trigger workflow",
      });

      return {
        proof: proofSnapshot(proof),
        upload: buildUploadTicket(uploadPath, input.fileType.trim(), input.fileName.trim()),
      };
    },
    async verifyTriggerProof(
      principal: TriggerPrincipal,
      requestId: string,
      proofId: string,
      input: { verificationStatus: "VERIFIED" | "REJECTED"; adminRemarks?: string | null },
      context: AuthRequestContext
    ) {
      let request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      ensureDecisionRole(principal);
      await assertProofReviewPermissions(principal);

      const proof = await store.updateProofVerification(
        requestId,
        proofId,
        input.verificationStatus,
        principal.user.id,
        input.adminRemarks?.trim() ?? null
      );

      if (!proof) {
        throw new HttpError(404, "TRIGGER_PROOF_NOT_FOUND", "Proof not found.");
      }

      const note = input.adminRemarks?.trim();
      if (note) {
        await store.createVerificationNote(requestId, principal.user.id, note);
      }

      if (input.verificationStatus === "VERIFIED") {
        const updatedRequest = await store.updateRequestStatus(
          request.id,
          "UNDER_REVIEW",
          principal.user.id,
          toTriggerActorRole(principal.user.role)
        );
        if (updatedRequest) {
          request = updatedRequest;
        }
      }

      await logSensitiveAction(
        principal,
        input.verificationStatus === "VERIFIED" ? "TRIGGER_PROOF_VERIFIED" : "TRIGGER_PROOF_REJECTED",
        "trigger_proof",
        proof.id,
        proofSnapshot(proof),
        null,
        context,
        "MEDIUM"
      );

      await notifyRequestParticipants(request, {
        title: input.verificationStatus === "VERIFIED" ? "Proof verified" : "Proof rejected",
        message:
          input.verificationStatus === "VERIFIED"
            ? `${request.subjectLine} has at least one verified proof.`
            : `${request.subjectLine} requires an updated proof submission.`,
        category: "workflow",
        priority: "high",
        actionLabel: "Open request",
        source: "Verification desk",
      });

      return {
        request: await enrichRequest(request),
        proof: proofSnapshot(proof),
        release: null,
      };
    },
    async requestTriggerMoreInfo(
      principal: TriggerPrincipal,
      requestId: string,
      input: { reason: string },
      context: AuthRequestContext
    ) {
      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      ensureDecisionRole(principal);
      await assertProofReviewPermissions(principal);

      if (!input.reason.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "A reason is required.");
      }

      const updated = await store.updateRequestReview(
        requestId,
        "ADDITIONAL_INFO_REQUIRED",
        principal.user.id,
        toTriggerActorRole(principal.user.role),
        input.reason.trim(),
        input.reason.trim()
      );
      if (!updated) {
        throw new HttpError(500, "TRIGGER_REQUEST_UPDATE_FAILED", "Trigger request status could not be updated.");
      }

      await logSensitiveAction(
        principal,
        "TRIGGER_MORE_INFO_REQUESTED",
        "trigger_request",
        updated.id,
        requestSnapshot(updated),
        requestSnapshot(request),
        context
      );

      await notifyRequestParticipants(updated, {
        title: "More information requested",
        message: `${updated.subjectLine} needs an additional clarification.`,
        category: "workflow",
        priority: "high",
        actionLabel: "Review request",
        source: "Verification desk",
      });

      return enrichRequest(updated);
    },
    async approveTriggerRequest(
      principal: TriggerPrincipal,
      requestId: string,
      input: { adminRemarks?: string | null },
      context: AuthRequestContext
    ) {
      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      ensureDecisionRole(principal);
      await assertTriggerDecisionPermissions(principal, "approve");

      const proofs = await store.listProofs(requestId);
      if (!proofs.some((proof) => proof.verificationStatus === "VERIFIED")) {
        throw new HttpError(409, "TRIGGER_REQUEST_NOT_READY", "At least one verified proof is required before approval.");
      }

      const approved = await finalizeApprovedDocumentAccessRequest(
        principal,
        request,
        context,
        input.adminRemarks?.trim() ?? null
      );
      return enrichRequest(approved.request);
    },
    async rejectTriggerRequest(
      principal: TriggerPrincipal,
      requestId: string,
      input: { adminRemarks?: string | null },
      context: AuthRequestContext
    ) {
      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      ensureDecisionRole(principal);
      await assertTriggerDecisionPermissions(principal, "reject");

      const updated = await store.updateRequestReview(
        requestId,
        "REJECTED",
        principal.user.id,
        toTriggerActorRole(principal.user.role),
        input.adminRemarks?.trim() ?? null
      );
      if (!updated) {
        throw new HttpError(500, "TRIGGER_REQUEST_UPDATE_FAILED", "Trigger request status could not be updated.");
      }

      await logSensitiveAction(
        principal,
        "TRIGGER_REQUEST_REJECTED",
        "trigger_request",
        updated.id,
        requestSnapshot(updated),
        requestSnapshot(request),
        context,
        "MEDIUM"
      );

      await notifyRequestParticipants(updated, {
        title: "Trigger request rejected",
        message: `${updated.subjectLine} was not approved for release.`,
        category: "workflow",
        priority: "high",
        actionLabel: "Review decision",
        source: "Verification desk",
      });

      return enrichRequest(updated);
    },
    async getTriggerRequestTimeline(principal: TriggerPrincipal, requestId: string): Promise<TriggerTimelineEntry[]> {
      const request = await store.findRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "TRIGGER_REQUEST_NOT_FOUND", "Trigger request not found.");
      }

      await ensureRequestScope(principal, request);
      return store.listTimeline(requestId);
    },
  };
}

export type TriggerService = ReturnType<typeof createTriggerService>;
