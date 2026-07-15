import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext, UserRole } from "../auth/types.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { HttpError } from "../../utils/http.js";
import { createEmailService } from "../email/email.service.js";
import { assertRole } from "../rbac/rbac.guard.js";
import type {
  NomineeAssignedDocumentRecord,
  NomineeInviteInput,
  NomineeRecord,
  NomineeUpdateInput,
  NomineeViewRecord,
} from "./types.js";
import type { NomineeStore } from "./nominee.store.js";
import type { AccessRuleStore } from "../access-rule/access-rule.store.js";
import type { VaultStore } from "../vault/vault.store.js";

type NomineeServiceStore = Pick<
  AuthStore,
  "findUserByEmail" | "findUserById" | "updateUser" | "insertAuditLog" | "insertSecurityEvent" | "createNotification"
>;

type NomineeServiceAccessStore = Pick<AccessRuleStore, "listRules">;

type NomineeServiceVaultStore = Pick<VaultStore, "listDocuments">;

function mapNomineeView(record: NomineeViewRecord) {
  return {
    id: record.id,
    customerId: record.customerId,
    nomineeUserId: record.nomineeUserId,
    fullName: record.fullName,
    email: record.email,
    mobile: record.mobile,
    relationship: record.relationship,
    customRelationship: record.customRelationship,
    notes: record.notes,
    status: record.status,
    invitationStatus: record.invitationStatus,
    verificationStatus: record.verificationStatus,
    invitedAt: record.invitedAt,
    acceptedAt: record.acceptedAt,
    removedAt: record.removedAt,
    updatedAt: record.updatedAt,
    assignedCount: record.assignedCount,
  };
}

function isInvitationExpired(record: NomineeRecord) {
  const expiry = record.invitationExpiresAt ? new Date(record.invitationExpiresAt).getTime() : new Date(record.invitedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  return Date.now() > expiry;
}

function requireCustomer(role: UserRole) {
  assertRole(role, ["CUSTOMER"], "Only the owning customer can manage nominees.");
}

function buildAudit(input: {
  userId: string | null;
  role: UserRole | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  context: AuthRequestContext;
}) {
  return {
    userId: input.userId,
    role: input.role,
    action: input.action,
    moduleName: "nominee",
    entityType: input.entityType,
    entityId: input.entityId,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    ipAddress: input.context.ipAddress,
    deviceInfo: input.context.deviceInfo,
  };
}

function buildSecurityEvent(input: {
  userId: string | null;
  eventType: string;
  eventDescription: string;
  context: AuthRequestContext;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}) {
  return {
    userId: input.userId,
    eventType: input.eventType,
    eventDescription: input.eventDescription,
    ipAddress: input.context.ipAddress,
    deviceInfo: input.context.deviceInfo,
    riskLevel: input.riskLevel,
  };
}

function buildNotificationMetadata(input: {
  category: "workflow" | "security" | "release" | "compliance";
  priority: "low" | "medium" | "high";
  source: string;
  actionLabel: string;
  nomineeId: string;
  invitationUrl?: string | null;
  actionPath?: string | null;
}) {
  return {
    category: input.category,
    priority: input.priority,
    source: input.source,
    actionLabel: input.actionLabel,
    nomineeId: input.nomineeId,
    invitationUrl: input.invitationUrl ?? null,
    actionPath: input.actionPath ?? null,
  };
}

export function createNomineeService(
  env: AppEnv,
  logger: Logger,
  store: NomineeStore,
  authStore: NomineeServiceStore,
  accessRuleStore: NomineeServiceAccessStore,
  vaultStore: NomineeServiceVaultStore,
  emailService = createEmailService(env, logger)
) {
  async function logSensitiveAction(
    input: {
      userId: string | null;
      role: UserRole | null;
      action: string;
      entityType: string;
      entityId: string | null;
      oldValue?: Record<string, unknown> | null;
      newValue?: Record<string, unknown> | null;
      eventType: string;
      eventDescription: string;
      riskLevel: "LOW" | "MEDIUM" | "HIGH";
    },
    context: AuthRequestContext
  ) {
    await authStore.insertAuditLog(
      buildAudit({
        userId: input.userId,
        role: input.role,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        context,
      })
    );

    await authStore.insertSecurityEvent(
      buildSecurityEvent({
        userId: input.userId,
        eventType: input.eventType,
        eventDescription: input.eventDescription,
        context,
        riskLevel: input.riskLevel,
      })
    );
  }

  async function notifyCustomer(
    customerId: string,
    title: string,
    message: string,
    metadata: Record<string, unknown>
  ) {
    await authStore.createNotification({
      userId: customerId,
      title,
      message,
      channel: "IN_APP",
      status: "SENT",
      metadata,
    });
  }

  async function ensureOwnedNominee(customerId: string, nomineeId: string) {
    const nominee = await store.findNomineeById(nomineeId);
    if (!nominee || nominee.customerId !== customerId) {
      throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
    }

    return nominee;
  }

  function validateNomineeInput(input: NomineeInviteInput) {
    if (!input.fullName.trim() || !input.email.trim() || !input.mobile.trim() || !input.relationship.trim()) {
      throw new HttpError(400, "VALIDATION_ERROR", "fullName, email, mobile, and relationship are required.");
    }
  }

  function buildInvitationLink(token: string) {
    const origin = env.FRONTEND_ORIGIN ?? "http://localhost:3000";
    return new URL(`/onboarding/accept-invitation?token=${encodeURIComponent(token)}`, origin).toString();
  }

  function buildInvitationNotificationLink(token: string) {
    return buildInvitationLink(token);
  }

  return {
    async getAllNominees(principal: { user: { id: string; role: UserRole; email: string } }) {
      assertRole(principal.user.role, ["NOMINEE"], "Only an invited nominee can view this record.");

      const linkedNominees = await store.findAllNomineesByUserId(principal.user.id);

      if (!linkedNominees.length) {
        return [];
      }

      const results = await Promise.all(
        linkedNominees.map(async (nominee) => {
          const customer = await authStore.findUserById(nominee.customerId);
          const [rules, documents] = await Promise.all([
            accessRuleStore.listRules(nominee.customerId, { nomineeId: nominee.id, status: "ACTIVE" }),
            vaultStore.listDocuments(nominee.customerId),
          ]);

          const assignedDocuments = rules
            .map<NomineeAssignedDocumentRecord | null>((rule) => {
              const document =
                documents.find((item) => item.id === rule.documentId) ??
                (rule.categoryId ? documents.find((item) => item.categoryId === rule.categoryId) ?? null : null);

              if (!document) {
                return null;
              }

              return {
                ruleId: rule.id,
                documentId: document.id,
                documentTitle: document.documentTitle,
                fileName: document.originalFileName,
                fileType: document.fileMimeType,
                fileSize: document.fileSize,
                categoryId: document.categoryId,
                categoryName: document.categoryName,
                canView: rule.canView,
                canDownload: rule.canDownload,
                releaseCondition: rule.releaseCondition,
                conditionNotes: rule.conditionNotes,
                documentUpdatedAt: document.updatedAt,
              };
            })
            .filter((item): item is NomineeAssignedDocumentRecord => Boolean(item))
            .sort((left, right) => left.documentTitle.localeCompare(right.documentTitle));

          return {
            ...nominee,
            customerName: customer?.fullName ?? null,
            assignedDocuments,
          };
        })
      );

      return results;
    },
    async getCurrentNominee(principal: { user: { id: string; role: UserRole; email: string } }) {
      assertRole(principal.user.role, ["NOMINEE"], "Only an invited nominee can view this record.");

      const linkedNominee = await store.findNomineeByUserId(principal.user.id);
      const nominee = linkedNominee ?? (await store.findNomineeByEmail(principal.user.email));

      if (!nominee || nominee.status === "REMOVED") {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "No nominee assignment exists for this account.");
      }

      const currentNominee =
        nominee.nomineeUserId === principal.user.id
          ? nominee
          : nominee.nomineeUserId
            ? null
            : await store.acceptInvitation(nominee.id, principal.user.id);

      if (!currentNominee) {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "No nominee assignment exists for this account.");
      }

      const customer = await authStore.findUserById(currentNominee.customerId);
      const [rules, documents] = await Promise.all([
        accessRuleStore.listRules(currentNominee.customerId, { nomineeId: currentNominee.id, status: "ACTIVE" }),
        vaultStore.listDocuments(currentNominee.customerId),
      ]);

      const assignedDocuments = rules
        .map<NomineeAssignedDocumentRecord | null>((rule) => {
          const document =
            documents.find((item) => item.id === rule.documentId) ??
            (rule.categoryId ? documents.find((item) => item.categoryId === rule.categoryId) ?? null : null);

          if (!document) {
            return null;
          }

          return {
            ruleId: rule.id,
            documentId: document.id,
            documentTitle: document.documentTitle,
            fileName: document.originalFileName,
            fileType: document.fileMimeType,
            fileSize: document.fileSize,
            categoryId: document.categoryId,
            categoryName: document.categoryName,
            canView: rule.canView,
            canDownload: rule.canDownload,
            releaseCondition: rule.releaseCondition,
            conditionNotes: rule.conditionNotes,
            documentUpdatedAt: document.updatedAt,
          };
        })
        .filter((item): item is NomineeAssignedDocumentRecord => Boolean(item))
        .sort((left, right) => left.documentTitle.localeCompare(right.documentTitle));

      return {
        ...currentNominee,
        customerName: customer?.fullName ?? null,
        assignedDocuments,
      };
    },
    async getInvitationContext(token: string) {
      if (!token.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invitation token is required.");
      }

      const tokenHash = sha256Hex(token.trim());
      const nominee = await store.findNomineeByInvitationTokenHash(tokenHash);
      if (!nominee) {
        throw new HttpError(400, "INVALID_TOKEN", "The invitation token is invalid or has expired.");
      }

      if (isInvitationExpired(nominee)) {
        throw new HttpError(400, "INVITATION_EXPIRED", "The invitation token has expired.");
      }

      return {
        fullName: nominee.fullName,
        email: nominee.email,
        expiresAt: nominee.invitationExpiresAt,
        isExpired: isInvitationExpired(nominee),
        invitationStatus: nominee.invitationStatus,
      };
    },
    async resendExpiredInvitationByToken(token: string, context: AuthRequestContext) {
      if (!token.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invitation token is required.");
      }

      const tokenHash = sha256Hex(token.trim());
      const nominee = await store.findNomineeByInvitationTokenHash(tokenHash);
      if (!nominee) {
        throw new HttpError(400, "INVALID_TOKEN", "The invitation token is invalid or has expired.");
      }

      if (!isInvitationExpired(nominee)) {
        throw new HttpError(409, "INVITATION_ACTIVE", "This invitation is still active.");
      }

      if (!nominee.email) {
        throw new HttpError(400, "VALIDATION_ERROR", "This invitation does not have an email address to resend to.");
      }

      if (nominee.status === "ACTIVE" || nominee.status === "REMOVED") {
        throw new HttpError(409, "INVITATION_CLOSED", "This invitation can no longer be resent.");
      }

      const freshToken = randomToken(32);
      const invitationTokenHash = sha256Hex(freshToken);
      const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const updated = await store.resendInvitation(nominee.id, invitationTokenHash, invitationExpiresAt);
      if (!updated) {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
      }

      try {
        await emailService.sendNomineeInvitationEmail(
          nominee.email,
          nominee.fullName,
          "INHERIX owner",
          nominee.relationship,
          buildInvitationLink(freshToken)
        );
      } catch (error) {
        logger.warn("Nominee invitation resend could not be delivered from token flow", {
          nomineeId: nominee.id,
          nomineeEmail: nominee.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await logSensitiveAction(
        {
          userId: nominee.nomineeUserId ?? null,
          role: nominee.nomineeUserId ? "NOMINEE" : null,
          action: "NOMINEE_INVITATION_RESENT_FROM_TOKEN",
          entityType: "nominee",
          entityId: nominee.id,
          oldValue: { invitedAt: nominee.invitedAt, expiresAt: nominee.invitationExpiresAt },
          newValue: { invitedAt: updated.invitedAt, expiresAt: updated.invitationExpiresAt },
          eventType: "NOMINEE_INVITATION_RESENT_FROM_TOKEN",
          eventDescription: `Expired invitation resent for ${nominee.email}.`,
          riskLevel: "LOW",
        },
        context
      );

      return {
        nominee: updated,
        email: nominee.email,
        expiresAt: updated.invitationExpiresAt,
      };
    },
    async listNominees(principal: { user: { id: string; role: UserRole } }) {
      requireCustomer(principal.user.role);
      return store.listNominees(principal.user.id);
    },
    async getNominee(principal: { user: { id: string; role: UserRole } }, nomineeId: string) {
      requireCustomer(principal.user.role);
      const nominee = await ensureOwnedNominee(principal.user.id, nomineeId);
      return nominee;
    },
    async createNominee(
      principal: { user: { id: string; role: UserRole; fullName?: string; email?: string } },
      input: NomineeInviteInput,
      context: AuthRequestContext
    ) {
      requireCustomer(principal.user.role);
      validateNomineeInput(input);

      const existing = await store.findNomineeByEmail(principal.user.id, input.email.trim());
      if (existing && existing.status !== "REMOVED") {
        throw new HttpError(409, "NOMINEE_ALREADY_EXISTS", "A nominee with this email already exists.");
      }

      const token = randomToken(32);
      const invitationTokenHash = sha256Hex(token);
      const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const nominee = await store.createNominee(
        {
          ...input,
          customerId: principal.user.id,
        },
        invitationTokenHash,
        invitationExpiresAt
      );
      try {
        const invitationUrl = buildInvitationNotificationLink(token);
        await emailService.sendNomineeInvitationEmail(
          input.email,
          input.fullName,
          principal.user.fullName ?? "INHERIX customer",
          input.relationship,
          invitationUrl
        );
      } catch (error) {
        logger.warn("Nominee invitation email could not be delivered", {
          nomineeId: nominee.id,
          nomineeEmail: input.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await logSensitiveAction(
        {
          userId: principal.user.id,
          role: principal.user.role,
          action: "NOMINEE_INVITED",
          entityType: "nominee",
          entityId: nominee.id,
          newValue: {
            fullName: nominee.fullName,
            email: nominee.email,
            relationship: nominee.relationship,
            customRelationship: nominee.customRelationship,
            status: nominee.status,
          },
          eventType: "NOMINEE_INVITED",
          eventDescription: `Nominee invitation prepared for ${nominee.email}.`,
          riskLevel: "LOW",
        },
        context
      );

      await notifyCustomer(
        nominee.customerId,
        "Nominee invited",
        `${nominee.fullName} has been invited as a trusted nominee. Open the invitation link to continue the nominee onboarding.`,
        buildNotificationMetadata({
          category: "workflow",
          priority: "medium",
          source: "Nominee management",
          actionLabel: "Review and resend invite",
          nomineeId: nominee.id,
          invitationUrl: buildInvitationNotificationLink(token),
          actionPath: "/dashboard/family",
        })
      );

      return nominee;
    },
    async updateNominee(
      principal: { user: { id: string; role: UserRole } },
      nomineeId: string,
      input: NomineeUpdateInput,
      context: AuthRequestContext
    ) {
      requireCustomer(principal.user.role);
      const current = await ensureOwnedNominee(principal.user.id, nomineeId);
      const updated = await store.updateNominee(nomineeId, input);
      if (!updated) {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
      }

      await logSensitiveAction(
        {
          userId: principal.user.id,
          role: principal.user.role,
          action: "NOMINEE_UPDATED",
          entityType: "nominee",
          entityId: nomineeId,
          oldValue: {
            fullName: current.fullName,
            email: current.email,
            relationship: current.relationship,
            customRelationship: current.customRelationship,
          },
          newValue: {
            fullName: updated.fullName,
            email: updated.email,
            relationship: updated.relationship,
            customRelationship: updated.customRelationship,
          },
          eventType: "NOMINEE_UPDATED",
          eventDescription: `Nominee record updated for ${updated.fullName}.`,
          riskLevel: "LOW",
        },
        context
      );

      await notifyCustomer(
        current.customerId,
        "Nominee updated",
        `${updated.fullName}'s trusted contact details were updated.`,
        buildNotificationMetadata({
          category: "workflow",
          priority: "low",
          source: "Nominee management",
          actionLabel: "Review nominee",
          nomineeId: nomineeId,
        })
      );

      return updated;
    },
    async resendInvitation(
      principal: { user: { id: string; role: UserRole; fullName?: string } },
      nomineeId: string,
      context: AuthRequestContext
    ) {
      requireCustomer(principal.user.role);
      const current = await ensureOwnedNominee(principal.user.id, nomineeId);
      if (current.status === "REMOVED") {
        throw new HttpError(400, "NOMINEE_REMOVED", "Removed nominees cannot receive invites.");
      }

      const token = randomToken(32);
      const invitationTokenHash = sha256Hex(token);
      const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const updated = await store.resendInvitation(nomineeId, invitationTokenHash, invitationExpiresAt);
      if (!updated) {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
      }

      try {
        const invitationUrl = buildInvitationNotificationLink(token);
        await emailService.sendNomineeInvitationEmail(
          updated.email ?? "",
          updated.fullName,
          principal.user.fullName ?? "INHERIX customer",
          updated.relationship,
          invitationUrl
        );
      } catch (error) {
        logger.warn("Nominee invitation resend could not be delivered", {
          nomineeId: nomineeId,
          nomineeEmail: updated.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await logSensitiveAction(
        {
          userId: principal.user.id,
          role: principal.user.role,
          action: "NOMINEE_INVITE_RESENT",
          entityType: "nominee",
          entityId: nomineeId,
          oldValue: { status: current.status, invitedAt: current.invitedAt },
          newValue: { status: updated.status, invitedAt: updated.invitedAt },
          eventType: "NOMINEE_INVITE_RESENT",
          eventDescription: `Nominee invitation resent for ${updated.email}.`,
          riskLevel: "LOW",
        },
        context
      );

      await notifyCustomer(
        current.customerId,
        "Invitation resent",
        `A fresh invitation link was sent to ${updated.fullName}.`,
        buildNotificationMetadata({
          category: "workflow",
          priority: "medium",
          source: "Nominee management",
          actionLabel: "View invite link",
          nomineeId: nomineeId,
          invitationUrl: buildInvitationNotificationLink(token),
          actionPath: "/dashboard/family",
        })
      );

      return updated;
    },
    async removeNominee(
      principal: { user: { id: string; role: UserRole } },
      nomineeId: string,
      context: AuthRequestContext
    ) {
      requireCustomer(principal.user.role);
      const current = await ensureOwnedNominee(principal.user.id, nomineeId);
      const updated = await store.removeNominee(nomineeId);
      if (!updated) {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
      }

      await logSensitiveAction(
        {
          userId: principal.user.id,
          role: principal.user.role,
          action: "NOMINEE_REMOVED",
          entityType: "nominee",
          entityId: nomineeId,
          oldValue: { status: current.status, removedAt: current.removedAt },
          newValue: { status: updated.status, removedAt: updated.removedAt },
          eventType: "NOMINEE_REMOVED",
          eventDescription: `Nominee removed from owner scope for ${updated.fullName}.`,
          riskLevel: "MEDIUM",
        },
        context
      );

      await notifyCustomer(
        current.customerId,
        "Nominee removed",
        `${updated.fullName} was removed from the continuity plan.`,
        buildNotificationMetadata({
          category: "security",
          priority: "high",
          source: "Nominee management",
          actionLabel: "Review access",
          nomineeId: nomineeId,
        })
      );

      return updated;
    },
    async acceptInvitation(
      principal: { user: { id: string; role: UserRole; email: string }; accessToken: string },
      input: { token: string },
      context: AuthRequestContext
    ) {
      if (!input.token.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invitation token is required.");
      }

      const tokenHash = sha256Hex(input.token.trim());
      const nominee = await store.findNomineeByInvitationTokenHash(tokenHash);
      if (!nominee) {
        throw new HttpError(400, "INVALID_TOKEN", "The invitation token is invalid or has expired.");
      }

      if (isInvitationExpired(nominee)) {
        throw new HttpError(400, "INVITATION_EXPIRED", "The invitation token has expired.");
      }

      if (!nominee.email || nominee.email.toLowerCase() !== principal.user.email.toLowerCase()) {
        throw new HttpError(403, "FORBIDDEN", "The invitation token does not match the signed-in account.");
      }

      const updatedUser = await authStore.updateUser(principal.user.id, {
        role: "NOMINEE",
        status: "ACTIVE",
      });

      if (!updatedUser) {
        throw new HttpError(500, "USER_UPDATE_FAILED", "Unable to activate the nominee account.");
      }

      const accepted = await store.acceptInvitation(nominee.id, principal.user.id);
      if (!accepted) {
        throw new HttpError(404, "NOMINEE_NOT_FOUND", "Nominee not found.");
      }

      await logSensitiveAction(
        {
          userId: updatedUser.id,
          role: "NOMINEE",
          action: "NOMINEE_INVITATION_ACCEPTED",
          entityType: "nominee",
          entityId: accepted.id,
          oldValue: { status: nominee.status, nomineeUserId: nominee.nomineeUserId },
          newValue: { status: accepted.status, nomineeUserId: accepted.nomineeUserId },
          eventType: "NOMINEE_INVITATION_ACCEPTED",
          eventDescription: `Nominee invitation accepted for ${accepted.email}.`,
          riskLevel: "LOW",
        },
        context
      );

      await notifyCustomer(
        accepted.customerId,
        "Nominee invitation accepted",
        `${accepted.fullName} accepted the invitation and can now access their release center.`,
        buildNotificationMetadata({
          category: "workflow",
          priority: "high",
          source: "Nominee onboarding",
          actionLabel: "Open nominee profile",
          nomineeId: accepted.id,
          actionPath: "/dashboard/family",
        })
      );

      await authStore.createNotification({
        userId: updatedUser.id,
        title: "Nominee access activated",
        message: "Your nominee account is active. Open the request desk to review released documents and continue the proof flow.",
        channel: "IN_APP",
        status: "SENT",
        metadata: {
          category: "workflow",
          priority: "high",
          source: "Nominee onboarding",
          actionLabel: "Open nominee request desk",
          nomineeId: accepted.id,
          actionPath: "/dashboard/released-documents/request",
        },
      });

      return {
        nominee: accepted,
        accessToken: principal.accessToken,
        nextPath: "/dashboard/released-documents/request",
      };
    },
  };
}

export type NomineeService = ReturnType<typeof createNomineeService>;
