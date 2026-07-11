import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext, UserRole } from "../auth/types.js";
import { HttpError } from "../../utils/http.js";
import { assertPermission, assertRole } from "../rbac/rbac.guard.js";
import { createS3Signer, type S3Signer } from "../vault/s3.js";
import type { TriggerActorRole } from "../trigger/types.js";
import type {
  ReleaseAccessAction,
  ReleaseAccessTicket,
  ReleasePrincipal,
  ReleaseQueueSummary,
  ReleaseRecord,
} from "./types.js";
import type { ReleaseStore } from "./release.store.js";

type ReleaseServiceStore = ReleaseStore & Pick<AuthStore, "insertAuditLog" | "insertSecurityEvent" | "listPermissionsForUser">;

function toTriggerActorRole(role: UserRole): TriggerActorRole {
  if (role === "CUSTOMER") return "customer";
  if (role === "NOMINEE") return "nominee";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "admin";
  return "system";
}

function makeAudit(
  principal: ReleasePrincipal,
  context: AuthRequestContext,
  action: string,
  entityType: string,
  entityId: string | null,
  newValue: Record<string, unknown> | null,
  oldValue: Record<string, unknown> | null = null
) {
  return {
    userId: principal.user.id,
    role: principal.user.role,
    action,
    moduleName: "release",
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
  };
}

function makeSecurityEvent(
  principal: ReleasePrincipal,
  context: AuthRequestContext,
  eventType: string,
  eventDescription: string,
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

function requestSnapshot(request: ReleaseQueueSummary["request"]) {
  return {
    id: request.id,
    customerId: request.customerId,
    nomineeId: request.nomineeId,
    nomineeName: request.nomineeName,
    nomineeUserId: request.nomineeUserId,
    requestKind: request.requestKind,
    subjectLine: request.subjectLine,
    summary: request.summary,
    priority: request.priority,
    status: request.status,
    reviewedAt: request.reviewedAt,
    resolvedAt: request.resolvedAt,
    latestActivityAt: request.latestActivityAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function queueSummarySnapshot(summary: ReleaseQueueSummary) {
  return {
    request: requestSnapshot(summary.request),
    eligibleDocumentCount: summary.eligibleDocumentCount,
    releasedDocumentCount: summary.releasedDocumentCount,
    verifiedProofCount: summary.verifiedProofCount,
  };
}

function releaseSnapshot(release: ReleaseRecord) {
  return {
    id: release.id,
    triggerRequestId: release.triggerRequestId,
    customerId: release.customerId,
    nomineeId: release.nomineeId,
    nomineeName: release.nomineeName,
    documentId: release.documentId,
    documentTitle: release.documentTitle,
    fileName: release.fileName,
    fileType: release.fileType,
    fileSize: release.fileSize,
    categoryId: release.categoryId,
    categoryName: release.categoryName,
    canView: release.canView,
    canDownload: release.canDownload,
    releaseStatus: release.releaseStatus,
    releaseNotes: release.releaseNotes,
    releasedBy: release.releasedBy,
    releasedAt: release.releasedAt,
    revokedAt: release.revokedAt,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
  };
}

export function createReleaseService(
  env: AppEnv,
  logger: Logger,
  store: ReleaseServiceStore,
  signer: S3Signer | null = null
) {
  logger.debug("Release service initialized", { module: "release" });
  let signerInstance = signer;

  async function logSensitiveAction(
    principal: ReleasePrincipal,
    action: string,
    entityType: string,
    entityId: string | null,
    newValue: Record<string, unknown> | null,
    oldValue: Record<string, unknown> | null,
    context: AuthRequestContext,
    riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW"
  ) {
    await store.insertAuditLog(makeAudit(principal, context, action, entityType, entityId, newValue, oldValue));
    await store.insertSecurityEvent(
      makeSecurityEvent(principal, context, action, `${action.replaceAll("_", " ").toLowerCase()} completed successfully.`, riskLevel)
    );
  }

  function requireAdmin(principal: ReleasePrincipal) {
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only admins can manage controlled releases.");
  }

  function requireNominee(principal: ReleasePrincipal) {
    assertRole(principal.user.role, ["NOMINEE"], "Only nominees can view released documents.");
  }

  async function ensureReleaseAccess(principal: ReleasePrincipal, release: ReleaseRecord) {
    if (principal.user.role === "ADMIN" || principal.user.role === "SUPER_ADMIN") {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "ADMIN_RELEASE_DOCUMENT", "You are not allowed to manage controlled releases.");
      return release;
    }

    requireNominee(principal);
    if (release.nomineeUserId !== principal.user.id) {
      throw new HttpError(404, "RELEASE_NOT_FOUND", "Release not found.");
    }

    return release;
  }

  async function getSigner() {
    if (!signerInstance) {
      signerInstance = createS3Signer(env);
    }

    return signerInstance;
  }

  return {
    async listReleaseQueue(principal: ReleasePrincipal) {
      requireAdmin(principal);
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "ADMIN_RELEASE_DOCUMENT", "You are not allowed to manage controlled releases.");

      const [requests, notifications, releases, accessLogs] = await Promise.all([
        store.listReleaseQueueSummaries(),
        store.listNotificationsForUser(principal.user.id),
        store.listReleasesForAdmin(),
        store.listAccessLogsForAdmin(),
      ]);

      return { requests, notifications, releases, accessLogs };
    },
    async getReleaseQueueRequest(principal: ReleasePrincipal, requestId: string) {
      requireAdmin(principal);
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "ADMIN_RELEASE_DOCUMENT", "You are not allowed to manage controlled releases.");

      const request = await store.findApprovedRequestById(requestId);
      if (!request) {
        throw new HttpError(404, "RELEASE_REQUEST_NOT_FOUND", "Approved trigger request not found.");
      }

      const documents = await store.listEligibleDocuments(requestId);
      const releases = await store.listReleasesByRequestId(requestId);
      const proofs = await store.listProofs(requestId);
      return {
        request: requestSnapshot(request),
        documents,
        releases,
        proofs,
      };
    },
    async createOrUpdateRelease(
      principal: ReleasePrincipal,
      input: {
        triggerRequestId: string;
        documentId: string;
        canView: boolean;
        canDownload: boolean;
        releaseNotes: string | null;
      },
      context: AuthRequestContext
    ) {
      requireAdmin(principal);
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "ADMIN_RELEASE_DOCUMENT", "You are not allowed to manage controlled releases.");

      const request = await store.findApprovedRequestById(input.triggerRequestId);
      if (!request) {
        throw new HttpError(404, "RELEASE_REQUEST_NOT_FOUND", "Approved trigger request not found.");
      }

      const eligibleDocuments = await store.listEligibleDocuments(input.triggerRequestId);
      const candidate = eligibleDocuments.find((item) => item.documentId === input.documentId);
      if (!candidate) {
        throw new HttpError(404, "RELEASE_DOCUMENT_NOT_FOUND", "This document is not eligible for controlled release.");
      }

      if ((input.canView && !candidate.canView) || (input.canDownload && !candidate.canDownload)) {
        throw new HttpError(400, "RELEASE_PERMISSION_EXCEEDED", "Release permissions cannot exceed the owner-defined rule.");
      }

      const existing = await store.findReleaseByComposite({
        triggerRequestId: input.triggerRequestId,
        documentId: input.documentId,
        nomineeId: request.nomineeId,
      });

      const release = await store.upsertRelease({
        triggerRequestId: input.triggerRequestId,
        customerId: request.customerId,
        nomineeId: request.nomineeId,
        documentId: input.documentId,
        releasedBy: principal.user.id,
        canView: input.canView,
        canDownload: input.canDownload,
        releaseNotes: input.releaseNotes?.trim() || candidate.conditionNotes || null,
      });

      await store.createNotification({
        userId: request.nomineeUserId ?? request.customerId,
        title: "Controlled release updated",
        message: `${release.documentTitle} is now ${release.releaseStatus.toLowerCase()} for controlled access.`,
        channel: "IN_APP",
        status: "SENT",
        metadata: {
          category: "release",
          priority: "high",
          source: "Release center",
          actionLabel: "Open release",
          releaseId: release.id,
          triggerRequestId: request.id,
        },
      });

      await logSensitiveAction(
        principal,
        existing ? "DOCUMENT_RELEASE_UPDATED" : "DOCUMENT_RELEASE_CREATED",
        "document_release",
        release.id,
        releaseSnapshot(release),
        existing ? releaseSnapshot(existing) : null,
        context,
        "MEDIUM"
      );

      if (existing) {
        await logSensitiveAction(
          principal,
          "DOCUMENT_RELEASE_CREATED",
          "document_release",
          release.id,
          releaseSnapshot(release),
          null,
          context,
          "MEDIUM"
        );
      }

      return {
        request,
        release,
      };
    },
    async revokeRelease(
      principal: ReleasePrincipal,
      releaseId: string,
      notes: string | null,
      context: AuthRequestContext
    ) {
      requireAdmin(principal);
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "ADMIN_RELEASE_DOCUMENT", "You are not allowed to manage controlled releases.");

      const current = await store.findReleaseById(releaseId);
      if (!current) {
        throw new HttpError(404, "RELEASE_NOT_FOUND", "Release not found.");
      }

      const revoked = await store.revokeRelease(releaseId, principal.user.id, notes?.trim() || null);
      if (!revoked) {
        throw new HttpError(500, "RELEASE_UPDATE_FAILED", "Release could not be revoked.");
      }

      await store.createNotification({
        userId: current.nomineeUserId ?? current.customerId,
        title: "Controlled release revoked",
        message: revoked.releaseNotes ?? "A document release was revoked by an admin.",
        channel: "IN_APP",
        status: "SENT",
        metadata: {
          category: "release",
          priority: "high",
          source: "Release center",
          actionLabel: "Review release",
          releaseId: revoked.id,
          triggerRequestId: revoked.triggerRequestId,
        },
      });

      await logSensitiveAction(
        principal,
        "DOCUMENT_RELEASE_REVOKED",
        "document_release",
        revoked.id,
        releaseSnapshot(revoked),
        releaseSnapshot(current),
        context,
        "MEDIUM"
      );

      return revoked;
    },
    async listReleasedDocuments(principal: ReleasePrincipal) {
      requireNominee(principal);
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(permissions, "NOMINEE_VIEW_RELEASED_DOCUMENT", "You are not allowed to view released documents.");
      logger.debug("Listing released documents for nominee", {
        userId: principal.user.id,
        role: principal.user.role,
      });
      const releases = await store.listReleasedDocumentsForNominee(principal.user.id);
      logger.debug("Nominee released documents retrieved", {
        userId: principal.user.id,
        releaseCount: releases.length,
      });
      return {
        releases,
        notifications: await store.listNotificationsForUser(principal.user.id),
        accessLogs: await store.listAccessLogsForNominee(principal.user.id),
      };
    },
    async requestReleasedDocumentAccess(
      principal: ReleasePrincipal,
      releaseId: string,
      action: ReleaseAccessAction,
      context: AuthRequestContext
    ): Promise<ReleaseAccessTicket> {
      requireNominee(principal);
      const permissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(
        permissions,
        action === "view" ? "NOMINEE_VIEW_RELEASED_DOCUMENT" : "NOMINEE_DOWNLOAD_RELEASED_DOCUMENT",
        "You are not allowed to access this released document."
      );
      logger.debug("Requesting released document access", {
        userId: principal.user.id,
        role: principal.user.role,
        releaseId,
        action,
      });

      const release = await store.findReleaseById(releaseId);
      logger.debug("Release lookup result", {
        releaseId,
        found: Boolean(release),
        nomineeUserId: release?.nomineeUserId ?? null,
        releaseStatus: release?.releaseStatus ?? null,
      });

      if (!release) {
        throw new HttpError(404, "RELEASE_NOT_FOUND", "Release not found.");
      }

      await ensureReleaseAccess(principal, release);

      if (release.releaseStatus !== "RELEASED") {
        throw new HttpError(409, "RELEASE_NOT_ACTIVE", "This document release is not active.");
      }

      if (action === "view" && !release.canView) {
        throw new HttpError(403, "RELEASE_VIEW_NOT_ALLOWED", "Preview access is not allowed for this release.");
      }

      if (action === "download" && !release.canDownload) {
        throw new HttpError(403, "RELEASE_DOWNLOAD_NOT_ALLOWED", "Download access is not allowed for this release.");
      }

      const releasedRecord = await store.findReleaseAccessContext(releaseId);
      if (!releasedRecord) {
        throw new HttpError(404, "RELEASE_NOT_FOUND", "Release not found.");
      }

      const signerInstance = await getSigner();
      const download = signerInstance.signGetObject(releasedRecord.encryptedFilePath, releasedRecord.release.fileName ?? releasedRecord.release.documentTitle, action === "view" ? "inline" : "attachment");

      await store.createAccessLog({
        releaseId: releasedRecord.release.id,
        nomineeId: releasedRecord.release.nomineeId,
        documentId: releasedRecord.release.documentId,
        documentTitle: releasedRecord.release.documentTitle,
        action: action === "view" ? "VIEWED" : "DOWNLOADED",
        actorName: principal.user.fullName ?? principal.user.email,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
      });

      await logSensitiveAction(
        principal,
        action === "view" ? "RELEASE_VIEW_URL_ISSUED" : "RELEASE_DOWNLOAD_URL_ISSUED",
        "document_release",
        releasedRecord.release.id,
        { releaseId: releasedRecord.release.id, action },
        null,
        context,
        "MEDIUM"
      );

      return { release: releasedRecord.release, download };
    },
  };
}

export type ReleaseService = ReturnType<typeof createReleaseService>;
