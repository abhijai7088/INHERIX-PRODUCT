import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createReleaseService } from "../dist/modules/release/release.service.js";
import { createTriggerService } from "../dist/modules/trigger/trigger.service.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: 0,
  API_PREFIX: "/api/v1",
  API_BASE_URL: "http://127.0.0.1:0/api/v1",
  LOG_LEVEL: "silent",
  FRONTEND_ORIGIN: "http://localhost:3000",
  SWAGGER_ENABLED: true,
  TRUST_PROXY: false,
  REQUEST_BODY_LIMIT: "1mb",
  DATABASE_URL: undefined,
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  S3_BUCKET_NAME: "bucket",
  AWS_REGION: "ap-south-1",
  AWS_KMS_KEY_ID: "kms-key",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key",
  AWS_SESSION_TOKEN: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: "no-reply@inherix.local",
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createPrincipal(role, id, email, fullName, permissions) {
  return {
    user: {
      id,
      email,
      fullName,
      role,
    },
    session: {
      id: `${id}-session`,
    },
    accessToken: `${id}-token`,
    authenticatedBy: "access",
    permissions,
  };
}

function createFakeSigner() {
  return {
    signPutObject(key, contentType) {
      return {
        url: `https://uploads.example/${encodeURIComponent(key)}`,
        expiresAt: "2026-06-09T00:15:00.000Z",
        requiredHeaders: {
          "x-amz-server-side-encryption": "aws:kms",
          "x-amz-server-side-encryption-aws-kms-key-id": "kms-test",
          ...(contentType ? { "content-type": contentType } : {}),
        },
      };
    },
    signGetObject(key, fileName) {
      return {
        url: `https://downloads.example/${encodeURIComponent(key)}?name=${encodeURIComponent(fileName ?? "")}`,
        expiresAt: "2026-06-09T00:10:00.000Z",
        requiredHeaders: {},
      };
    },
    async signDeleteObject() {},
  };
}

function createWorkflowMemoryStore() {
  const nominees = [
    {
      id: "nominee-1",
      customerId: "customer-1",
      nomineeUserId: "nominee-user-1",
      fullName: "Nominee One",
      email: "nominee@example.com",
      mobile: "+91 9999999999",
      relationship: "spouse",
      customRelationship: null,
      status: "ACTIVE",
    },
  ];

  const users = [
    {
      id: "admin-1",
      fullName: "Admin User",
      email: "admin@example.com",
      role: "ADMIN",
    },
    {
      id: "nominee-user-1",
      fullName: "Nominee One",
      email: "nominee@example.com",
      role: "NOMINEE",
    },
  ];

  const documents = [
    {
      id: "document-1",
      customerId: "customer-1",
      categoryId: "category-1",
      documentTitle: "Identity Certificate",
      originalFileName: "identity-certificate.pdf",
      fileMimeType: "application/pdf",
      fileSize: 2048,
      status: "ACTIVE",
      updatedAt: "2026-06-01T10:00:00.000Z",
      createdAt: "2026-06-01T10:00:00.000Z",
    },
  ];

  const accessRules = [
    {
      id: "rule-1",
      customerId: "customer-1",
      nomineeId: "nominee-1",
      documentId: "document-1",
      categoryId: null,
      canView: true,
      canDownload: false,
      releaseCondition: "ON_APPROVAL",
      conditionNotes: "Release only after trigger approval.",
      isActive: true,
      revokedAt: null,
      deletedAt: null,
      status: "ACTIVE",
    },
  ];

  const requests = [];
  const proofs = [];
  const releases = [];
  const accessLogs = [];
  const notifications = [];
  const auditLogs = [];
  const securityEvents = [];

  function now() {
    return new Date().toISOString();
  }

  function nomineeForRequest(request) {
    return nominees.find((nominee) => nominee.id === request.nomineeId) ?? null;
  }

  function toRequestRecord(request) {
    const nominee = nomineeForRequest(request);
    const requestProofs = proofs
      .filter((proof) => proof.triggerRequestId === request.id)
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
    const document = request.documentId ? documents.find((item) => item.id === request.documentId) ?? null : null;
    const accessRule = document
      ? accessRules.find(
          (rule) =>
            rule.customerId === request.customerId &&
            rule.nomineeId === request.nomineeId &&
            rule.status === "ACTIVE" &&
            rule.isActive &&
            (rule.documentId === document.id || rule.categoryId === document.categoryId)
        ) ?? null
      : null;
    const accessRuleCanView = accessRule ? Boolean(accessRule.canView) : null;

    return {
      id: request.id,
      customerId: request.customerId,
      nomineeId: request.nomineeId,
      nomineeUserId: nominee?.nomineeUserId ?? null,
      nomineeName: nominee?.fullName ?? "Unknown nominee",
      nomineeEmail: nominee?.email ?? null,
      nomineeMobile: nominee?.mobile ?? null,
      relationship: nominee?.relationship ?? "spouse",
      customRelationship: nominee?.customRelationship ?? null,
      documentId: request.documentId ?? null,
      documentTitle: request.documentTitle ?? null,
      accessRuleId: accessRule?.id ?? null,
      accessRuleScope: accessRule?.documentId ? "DOCUMENT" : accessRule?.categoryId ? "CATEGORY" : null,
      accessRuleCanView,
      accessRuleCanDownload: accessRule ? accessRuleCanView && Boolean(accessRule.canDownload) : null,
      accessRuleCondition: accessRule?.releaseCondition ?? null,
      accessRuleNotes: accessRule?.conditionNotes ?? null,
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
      proofCount: requestProofs.length,
      latestProofId: requestProofs[0]?.id ?? null,
      requestedByUserId: request.requestedByUserId,
      lastActionBy: request.lastActionBy,
      lastActionRole: request.lastActionRole,
    };
  }

  function toProofRecord(proof) {
    const uploadedBy = users.find((user) => user.id === proof.uploadedBy) ?? null;
    return {
      id: proof.id,
      triggerRequestId: proof.triggerRequestId,
      fileName: proof.originalFileName,
      fileType: proof.fileMimeType,
      fileSize: proof.fileSize,
      fileHash: proof.fileHash,
      notes: proof.notes,
      uploadedBy: uploadedBy?.fullName ?? null,
      uploadedByRole: proof.uploadedByRole,
      verificationStatus: proof.verificationStatus,
      adminRemarks: proof.adminRemarks,
      createdAt: proof.uploadedAt,
    };
  }

  function toReleaseRecord(release) {
    if (!release) {
      return null;
    }

    const nominee = nomineeForRequest(requests.find((request) => request.id === release.triggerRequestId) ?? {});
    const document = documents.find((item) => item.id === release.documentId) ?? null;
    const releasedBy = users.find((user) => user.id === release.releasedBy) ?? null;

    return {
      id: release.id,
      triggerRequestId: release.triggerRequestId,
      customerId: release.customerId,
      nomineeId: release.nomineeId,
      nomineeName: nominee?.fullName ?? "Unknown nominee",
      nomineeUserId: nominee?.nomineeUserId ?? null,
      documentId: release.documentId,
      documentTitle: document?.documentTitle ?? "Unknown document",
      fileName: document?.originalFileName ?? null,
      fileType: document?.fileMimeType ?? null,
      fileSize: document?.fileSize ?? null,
      categoryId: document?.categoryId ?? "category-1",
      categoryName: "Identity",
      canView: release.canView,
      canDownload: release.canDownload,
      releaseStatus: release.releaseStatus,
      releaseNotes: release.releaseNotes,
      releasedBy: releasedBy?.fullName ?? null,
      releasedAt: release.releasedAt,
      revokedAt: release.revokedAt,
      createdAt: release.createdAt,
      updatedAt: release.updatedAt,
    };
  }

  function buildTimeline(request) {
    const timeline = [
      {
        id: `${request.id}-created`,
        requestId: request.id,
        action: "Request created",
        status: "DRAFT",
        actorName: "Nominee One",
        actorRole: "nominee",
        summary: request.summary,
        createdAt: request.createdAt,
      },
    ];

    if (request.submittedAt) {
      timeline.push({
        id: `${request.id}-submitted`,
        requestId: request.id,
        action: "Request submitted",
        status: "PENDING",
        actorName: "Nominee One",
        actorRole: "nominee",
        summary: "Request entered the review queue.",
        createdAt: request.submittedAt,
      });
    }

    if (request.additionalInfoRequestedAt) {
      timeline.push({
        id: `${request.id}-info`,
        requestId: request.id,
        action: "Additional information requested",
        status: "ADDITIONAL_INFO_REQUIRED",
        actorName: "Admin User",
        actorRole: "admin",
        summary: request.additionalInfoReason ?? "More information required.",
        createdAt: request.additionalInfoRequestedAt,
      });
    }

    for (const proof of proofs.filter((item) => item.triggerRequestId === request.id)) {
      timeline.push({
        id: `${proof.id}-proof`,
        requestId: request.id,
        action: "Proof uploaded",
        status: request.status,
        actorName: "Nominee One",
        actorRole: "nominee",
        summary: proof.notes ?? "Supporting proof uploaded.",
        createdAt: proof.uploadedAt,
      });
    }

    if (request.reviewedAt) {
      timeline.push({
        id: `${request.id}-reviewed`,
        requestId: request.id,
        action: request.status === "APPROVED" ? "Request approved" : "Request rejected",
        status: request.status,
        actorName: "Admin User",
        actorRole: "admin",
        summary: request.adminDecisionNote ?? "Review completed.",
        createdAt: request.reviewedAt,
      });
    }

    return timeline.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  function updateRequest(requestId, updater) {
    const request = requests.find((item) => item.id === requestId);
    if (!request) {
      return null;
    }

    updater(request);
    return toRequestRecord(request);
  }

  function listEligibleDocumentsInternal(requestId) {
    const request = requests.find((item) => item.id === requestId);
    if (!request) {
      return [];
    }

    return documents
      .filter((document) => document.customerId === request.customerId)
      .filter((document) => !request.documentId || request.documentId === document.id)
      .map((document) => {
        const rule = accessRules.find(
          (item) => item.nomineeId === request.nomineeId && item.isActive && (item.documentId === document.id || item.categoryId === document.categoryId)
        );
        const release = releases.find(
          (item) => item.triggerRequestId === request.id && item.documentId === document.id && item.nomineeId === request.nomineeId
        );

        return {
          documentId: document.id,
          documentTitle: document.documentTitle,
          fileName: document.originalFileName,
          fileType: document.fileMimeType,
          fileSize: document.fileSize,
          categoryId: document.categoryId,
          categoryName: "Identity",
          canView: rule?.canView ?? false,
          canDownload: rule?.canDownload ?? false,
          releaseCondition: rule?.releaseCondition ?? null,
          conditionNotes: rule?.conditionNotes ?? null,
          releaseId: release?.id ?? null,
          releaseStatus: release?.releaseStatus ?? "PENDING",
          releaseNotes: release?.releaseNotes ?? null,
          releasedAt: release?.releasedAt ?? null,
          revokedAt: release?.revokedAt ?? null,
          updatedAt: release?.updatedAt ?? document.updatedAt,
        };
      });
  }

  return {
    nominees,
    users,
    documents,
    accessRules,
    requests,
    proofs,
    releases,
    accessLogs,
    notifications,
    auditLogs,
    securityEvents,
    async findNomineeById(nomineeId) {
      return nominees.find((nominee) => nominee.id === nomineeId) ?? null;
    },
    async findNomineeByUserId(nomineeUserId) {
      return nominees.find((nominee) => nominee.nomineeUserId === nomineeUserId && nominee.status === "ACTIVE") ?? null;
    },
    async findUserById(userId) {
      return users.find((user) => user.id === userId) ?? null;
    },
    async findNomineeAssignment(customerId, nomineeUserId) {
      return nominees.find((nominee) => nominee.customerId === customerId && nominee.nomineeUserId === nomineeUserId) ?? null;
    },
    async listRequestsByCustomer(customerId, filters) {
      return requests
        .filter((request) => request.customerId === customerId)
        .filter((request) => !filters?.status || request.status === filters.status)
        .filter((request) => !filters?.requestKind || request.requestKind === filters.requestKind)
        .filter((request) => !filters?.documentId || request.documentId === filters.documentId)
        .map(toRequestRecord);
    },
    async listRequestsByNomineeUserId(nomineeUserId, filters) {
      return requests
        .filter((request) => nominees.find((nominee) => nominee.id === request.nomineeId && nominee.nomineeUserId === nomineeUserId))
        .filter((request) => !filters?.status || request.status === filters.status)
        .filter((request) => !filters?.requestKind || request.requestKind === filters.requestKind)
        .filter((request) => !filters?.documentId || request.documentId === filters.documentId)
        .map(toRequestRecord);
    },
    async listRequestsForAdmin(filters) {
      return requests
        .filter((request) => !filters?.status || request.status === filters.status)
        .filter((request) => !filters?.requestKind || request.requestKind === filters.requestKind)
        .filter((request) => !filters?.documentId || request.documentId === filters.documentId)
        .map(toRequestRecord);
    },
    async findRequestById(requestId) {
      const request = requests.find((item) => item.id === requestId);
      return request ? toRequestRecord(request) : null;
    },
    async createRequest(input) {
      const document = input.documentId ? documents.find((item) => item.id === input.documentId) ?? null : null;
      const request = {
        id: `request-${requests.length + 1}`,
        customerId: input.customerId,
        nomineeId: input.nomineeId,
        documentId: input.documentId ?? null,
        documentTitle: document?.documentTitle ?? null,
        requestKind: input.requestKind,
        subjectLine: input.subjectLine,
        summary: input.summary,
        priority: input.priority,
        status: "DRAFT",
        submittedAt: null,
        reviewedAt: null,
        resolvedAt: null,
        cancelledAt: null,
        additionalInfoRequestedAt: null,
        additionalInfoReason: null,
        adminDecisionNote: null,
        latestActivityAt: now(),
        createdAt: now(),
        updatedAt: now(),
        requestedByUserId: input.requestedByUserId,
        lastActionBy: input.requestedByUserId,
        lastActionRole: input.requestedByRole.toLowerCase(),
      };

      requests.unshift(request);
      return toRequestRecord(request);
    },
    async submitRequest(requestId, actorUserId, actorRole) {
      return updateRequest(requestId, (request) => {
        request.status = "PENDING";
        request.submittedAt = request.submittedAt ?? now();
        request.latestActivityAt = now();
        request.updatedAt = now();
        request.lastActionBy = actorUserId;
        request.lastActionRole = actorRole;
      });
    },
    async updateRequestStatus(requestId, status, actorUserId, actorRole) {
      return updateRequest(requestId, (request) => {
        request.status = status;
        request.latestActivityAt = now();
        request.updatedAt = now();
        request.lastActionBy = actorUserId;
        request.lastActionRole = actorRole;
      });
    },
    async createProof(input) {
      const proof = {
        id: `proof-${proofs.length + 1}`,
        triggerRequestId: input.triggerRequestId,
        uploadedBy: input.uploadedByUserId,
        uploadedByRole: input.uploadedByRole.toLowerCase(),
        proofType: "SUPPORTING_PROOF",
        originalFileName: input.fileName,
        encryptedFilePath: input.encryptedFilePath,
        fileMimeType: input.fileMimeType,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
        notes: input.notes,
        verificationStatus: "UPLOADED",
        adminRemarks: null,
        uploadedAt: now(),
      };

      proofs.unshift(proof);
      return toProofRecord(proof);
    },
    async listProofs(requestId) {
      return proofs.filter((proof) => proof.triggerRequestId === requestId).map(toProofRecord);
    },
    async deleteUnreviewedProof(requestId, proofId) {
      const proofIndex = proofs.findIndex(
        (proof) => proof.triggerRequestId === requestId && proof.id === proofId && proof.verificationStatus === "UPLOADED"
      );
      if (proofIndex === -1) {
        return null;
      }

      const [proof] = proofs.splice(proofIndex, 1);
      return {
        encryptedFilePath: proof.encryptedFilePath,
      };
    },
    async listTimeline(requestId) {
      const request = requests.find((item) => item.id === requestId);
      return request ? buildTimeline(request) : [];
    },
    async updateProofVerification(requestId, proofId, verificationStatus, adminUserId, adminRemarks) {
      const proof = proofs.find((item) => item.id === proofId && item.triggerRequestId === requestId);
      if (!proof) {
        return null;
      }

      proof.verificationStatus = verificationStatus;
      proof.adminRemarks = adminRemarks;
      proof.uploadedBy = proof.uploadedBy ?? adminUserId;
      return toProofRecord(proof);
    },
    async updateRequestReview(requestId, status, actorUserId, actorRole, adminRemarks, additionalInfoReason) {
      return updateRequest(requestId, (request) => {
        request.status = status;
        request.reviewedAt = now();
        request.resolvedAt = status === "APPROVED" || status === "REJECTED" ? now() : request.resolvedAt;
        request.additionalInfoRequestedAt = status === "ADDITIONAL_INFO_REQUIRED" ? now() : request.additionalInfoRequestedAt;
        request.additionalInfoReason = additionalInfoReason ?? request.additionalInfoReason;
        request.adminDecisionNote = adminRemarks ?? request.adminDecisionNote;
        request.latestActivityAt = now();
        request.updatedAt = now();
        request.lastActionBy = actorUserId;
        request.lastActionRole = actorRole;
      });
    },
    async createVerificationNote(requestId, _adminUserId, note) {
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        return;
      }

      request.adminDecisionNote = request.adminDecisionNote ? `${request.adminDecisionNote}\n${note}` : note;
    },
    async listPermissionsForUser(userId) {
      if (userId === "admin-1") {
        return [
          "ADMIN_VIEW_TRIGGER_QUEUE",
          "ADMIN_VERIFY_PROOF",
          "ADMIN_APPROVE_TRIGGER",
          "ADMIN_REJECT_TRIGGER",
          "ADMIN_RELEASE_DOCUMENT",
        ];
      }

      if (userId === "nominee-user-1") {
        return [
          "NOMINEE_RAISE_TRIGGER",
          "NOMINEE_UPLOAD_PROOF",
          "NOMINEE_VIEW_TRIGGER_STATUS",
          "NOMINEE_VIEW_RELEASED_DOCUMENT",
          "NOMINEE_DOWNLOAD_RELEASED_DOCUMENT",
        ];
      }

      return [];
    },
    async listRules(customerId, filters) {
      return accessRules
        .filter((rule) => !customerId || rule.customerId === customerId)
        .filter((rule) => !filters?.nomineeId || rule.nomineeId === filters.nomineeId)
        .filter((rule) => !filters?.documentId || rule.documentId === filters.documentId)
        .filter((rule) => !filters?.categoryId || rule.categoryId === filters.categoryId)
        .filter((rule) => !filters?.status || rule.status === filters.status);
    },
    async listDocuments(customerId) {
      return documents
        .filter((document) => document.customerId === customerId)
        .map((document) => ({
          id: document.id,
          vaultId: "vault-1",
          customerId: document.customerId,
          categoryId: document.categoryId,
          documentTitle: document.documentTitle,
          documentDescription: null,
          originalFileName: document.originalFileName,
          encryptedFilePath: `/tmp/${document.id}`,
          fileMimeType: document.fileMimeType,
          fileSize: document.fileSize,
          fileHash: null,
          encryptionKeyRef: null,
          status: document.status,
          uploadedAt: document.createdAt,
          updatedAt: document.updatedAt,
          vaultName: "Primary vault",
          categoryName: "Identity",
          categoryDescription: null,
        }));
    },
    async findReleaseByComposite(input) {
      return toReleaseRecord(
        releases.find(
          (release) =>
            release.triggerRequestId === input.triggerRequestId && release.documentId === input.documentId && release.nomineeId === input.nomineeId
        ) ?? null
      );
    },
    async listApprovedRequests() {
      return requests.filter((request) => request.status === "APPROVED").map(toRequestRecord);
    },
    async findApprovedRequestById(requestId) {
      const request = requests.find((item) => item.id === requestId && item.status === "APPROVED");
      return request ? toRequestRecord(request) : null;
    },
    async listEligibleDocuments(requestId) {
      return listEligibleDocumentsInternal(requestId);
    },
    async listReleasesByRequestId(requestId) {
      return releases.filter((release) => release.triggerRequestId === requestId).map(toReleaseRecord);
    },
    async listReleasesForAdmin() {
      return releases.map(toReleaseRecord);
    },
    async findReleaseById(releaseId) {
      return toReleaseRecord(releases.find((release) => release.id === releaseId) ?? null);
    },
    async findReleaseAccessContext(releaseId) {
      const release = releases.find((item) => item.id === releaseId);
      if (!release) {
        return null;
      }

      return {
        release: toReleaseRecord(release),
        encryptedFilePath: release.encryptedFilePath,
      };
    },
    async findReleaseAccessContextByComposite(input) {
      const release = releases.find(
        (item) => item.triggerRequestId === input.triggerRequestId && item.documentId === input.documentId && item.nomineeId === input.nomineeId
      );
      if (!release) {
        return null;
      }

      return {
        release: toReleaseRecord(release),
        encryptedFilePath: release.encryptedFilePath,
      };
    },
    async upsertRelease(input) {
      const existing = releases.find(
        (release) =>
          release.triggerRequestId === input.triggerRequestId && release.documentId === input.documentId && release.nomineeId === input.nomineeId
      );

      if (existing) {
        existing.customerId = input.customerId;
        existing.releasedBy = input.releasedBy;
        existing.canView = input.canView;
        existing.canDownload = input.canDownload;
        existing.releaseNotes = input.releaseNotes;
        existing.releaseStatus = "RELEASED";
        existing.releasedAt = existing.releasedAt ?? now();
        existing.revokedAt = null;
        existing.updatedAt = now();
        return toReleaseRecord(existing);
      }

      const release = {
        id: `release-${releases.length + 1}`,
        triggerRequestId: input.triggerRequestId,
        customerId: input.customerId,
        nomineeId: input.nomineeId,
        nomineeUserId: nominees.find((nominee) => nominee.id === input.nomineeId)?.nomineeUserId ?? null,
        documentId: input.documentId,
        encryptedFilePath: `/secure/${input.documentId}`,
        releasedBy: input.releasedBy,
        canView: input.canView,
        canDownload: input.canDownload,
        releaseNotes: input.releaseNotes,
        releaseStatus: "RELEASED",
        releasedAt: now(),
        revokedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };

      releases.unshift(release);
      return toReleaseRecord(release);
    },
    async revokeRelease(releaseId, revokedBy, notes) {
      const release = releases.find((item) => item.id === releaseId);
      if (!release) {
        return null;
      }

      release.releasedBy = revokedBy;
      release.releaseNotes = notes ?? release.releaseNotes;
      release.releaseStatus = "REVOKED";
      release.revokedAt = now();
      release.updatedAt = now();
      return toReleaseRecord(release);
    },
    async listReleasedDocumentsForNominee(nomineeUserId) {
      return releases
        .filter((release) => release.nomineeUserId === nomineeUserId && release.releaseStatus === "RELEASED")
        .map(toReleaseRecord);
    },
    async listAccessLogsForNominee(nomineeUserId) {
      return accessLogs.filter((log) => log.nomineeId === nominees.find((nominee) => nominee.nomineeUserId === nomineeUserId)?.id);
    },
    async createAccessLog(input) {
      accessLogs.unshift({
        id: `access-${accessLogs.length + 1}`,
        releaseId: input.releaseId,
        triggerRequestId: releases.find((release) => release.id === input.releaseId)?.triggerRequestId ?? input.releaseId,
        customerId: releases.find((release) => release.id === input.releaseId)?.customerId ?? "customer-1",
        nomineeId: input.nomineeId,
        documentId: input.documentId,
        documentTitle: input.documentTitle,
        action: input.action,
        actorName: input.actorName,
        ipAddress: input.ipAddress,
        deviceInfo: input.deviceInfo,
        accessedAt: now(),
      });
    },
    async listNotificationsForUser(userId) {
      return notifications.filter((notification) => notification.userId === userId);
    },
    async listAccessLogsForAdmin() {
      return accessLogs;
    },
    async createNotification(input) {
      notifications.unshift({
        id: `notification-${notifications.length + 1}`,
        userId: input.userId,
        title: input.title,
        message: input.message,
        channel: input.channel ?? "IN_APP",
        status: input.status ?? "SENT",
        readAt: null,
        sentAt: now(),
        metadata: input.metadata ?? {},
        createdAt: now(),
      });
    },
    async listReleaseQueueSummaries() {
      return (await this.listApprovedRequests()).map((request) => ({
        request,
        eligibleDocumentCount: listEligibleDocumentsInternal(request.id).length,
        releasedDocumentCount: releases.filter((release) => release.triggerRequestId === request.id && release.releaseStatus === "RELEASED").length,
        verifiedProofCount: proofs.filter((proof) => proof.triggerRequestId === request.id && proof.verificationStatus === "VERIFIED").length,
      }));
    },
    async listProofs(requestId) {
      return proofs.filter((proof) => proof.triggerRequestId === requestId).map(toProofRecord);
    },
    async insertAuditLog(entry) {
      auditLogs.unshift({
        ...entry,
        id: `audit-${auditLogs.length + 1}`,
        createdAt: now(),
      });
    },
    async insertSecurityEvent(entry) {
      securityEvents.unshift({
        ...entry,
        id: `security-${securityEvents.length + 1}`,
        createdAt: now(),
      });
    },
  };
}

test("approved trigger requests unlock controlled release and nominee-only access", async () => {
  const store = createWorkflowMemoryStore();
  const logger = createLogger("silent");
  const signer = createFakeSigner();
  const triggerService = createTriggerService(testEnv, logger, store, signer);
  const releaseService = createReleaseService(testEnv, logger, store, signer);

  const nominee = createPrincipal("NOMINEE", "nominee-user-1", "nominee@example.com", "Nominee One");
  const admin = createPrincipal("ADMIN", "admin-1", "admin@example.com", "Admin User");
  const context = {
    requestId: "req-1",
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    browserInfo: "browser",
    deviceInfo: "device",
    locationInfo: "location",
  };

  const created = await triggerService.createTriggerRequest(
    nominee,
    {
      requestKind: "document-access",
      documentId: "document-1",
      subjectLine: "Controlled access request",
      summary: "Please release the identity certificate.",
      priority: "High",
    },
    context
  );

  const submitted = await triggerService.submitTriggerRequest(nominee, created.id, context);
  assert.equal(submitted.status, "PENDING");

  const proofUpload = await triggerService.createProofUpload(
    nominee,
    {
      requestId: created.id,
      fileName: "identity-proof.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      notes: "Supporting proof for the request.",
    },
    context
  );
  assert.equal(proofUpload.proof.verificationStatus, "UPLOADED");

  await assert.rejects(
    releaseService.createOrUpdateRelease(
      admin,
      {
        triggerRequestId: created.id,
        documentId: "document-1",
        canView: true,
        canDownload: false,
        releaseNotes: "Attempt before approval.",
      },
      context
    ),
    (error) => error?.errorCode === "RELEASE_REQUEST_NOT_FOUND"
  );

  const reviewedProof = await triggerService.verifyTriggerProof(
    admin,
    created.id,
    proofUpload.proof.id,
    { verificationStatus: "VERIFIED", adminRemarks: "Evidence verified." },
    context
  );
  assert.equal(reviewedProof.proof.verificationStatus, "VERIFIED");
  assert.equal(reviewedProof.request.status, "UNDER_REVIEW");
  assert.equal(reviewedProof.release, null);

  const approved = await triggerService.approveTriggerRequest(admin, created.id, { adminRemarks: "Approved for release." }, context);
  assert.equal(approved.status, "APPROVED");

  const releaseQueue = await releaseService.listReleaseQueue(admin);
  assert.equal(releaseQueue.requests.length, 1);
  assert.equal(releaseQueue.requests[0].verifiedProofCount, 1);

  const releasedDocuments = await releaseService.listReleasedDocuments(nominee);
  assert.equal(releasedDocuments.releases.length, 1);
  const autoRelease = releasedDocuments.releases[0];

  assert.equal(autoRelease.releaseStatus, "RELEASED");
  assert.equal(autoRelease.canView, true);
  assert.equal(autoRelease.canDownload, false);

  await triggerService.approveTriggerRequest(admin, created.id, { adminRemarks: "Approved again." }, context);
  assert.equal(store.releases.length, 1);

  const nomineeView = await releaseService.requestReleasedDocumentAccess(nominee, autoRelease.id, "view", context);
  assert.ok(nomineeView.download.url.includes("downloads.example"));

  await assert.rejects(
    releaseService.requestReleasedDocumentAccess(nominee, autoRelease.id, "download", context),
    (error) => error?.errorCode === "RELEASE_DOWNLOAD_NOT_ALLOWED"
  );

  const revoked = await releaseService.revokeRelease(admin, autoRelease.id, "Release revoked for review.", context);
  assert.equal(revoked.releaseStatus, "REVOKED");

  await assert.rejects(
    releaseService.requestReleasedDocumentAccess(nominee, autoRelease.id, "view", context),
    (error) => error?.errorCode === "RELEASE_NOT_ACTIVE"
  );

  assert.ok(store.auditLogs.some((entry) => entry.action === "TRIGGER_REQUEST_APPROVED"));
  assert.ok(store.auditLogs.some((entry) => entry.action === "DOCUMENT_RELEASE_CREATED"));
  assert.ok(store.auditLogs.some((entry) => entry.action === "DOCUMENT_RELEASE_UPDATED"));
  assert.ok(store.auditLogs.some((entry) => entry.action === "DOCUMENT_RELEASE_REVOKED"));
  assert.ok(store.securityEvents.some((event) => event.eventType === "RELEASE_VIEW_URL_ISSUED"));
});
