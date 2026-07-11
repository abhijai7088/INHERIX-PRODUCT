import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";
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
  S3_BUCKET_NAME: undefined,
  AWS_REGION: undefined,
  AWS_KMS_KEY_ID: undefined,
  AWS_ACCESS_KEY_ID: undefined,
  AWS_SECRET_ACCESS_KEY: undefined,
  AWS_SESSION_TOKEN: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createNomineePrincipal() {
  return {
    user: {
      id: "nominee-user-1",
      email: "nominee@example.com",
      fullName: "Nominee User",
      role: "NOMINEE",
    },
    session: {
      id: "session-1",
    },
    accessToken: "nominee-access",
    authenticatedBy: "access",
  };
}

function createCustomerPrincipal() {
  return {
    user: {
      id: "customer-1",
      email: "customer@example.com",
      fullName: "Customer Owner",
      role: "CUSTOMER",
    },
    session: {
      id: "session-2",
    },
    accessToken: "customer-access",
    authenticatedBy: "access",
  };
}

function createOtherCustomerPrincipal() {
  return {
    user: {
      id: "customer-2",
      email: "other-customer@example.com",
      fullName: "Other Customer",
      role: "CUSTOMER",
    },
    session: {
      id: "session-3",
    },
    accessToken: "other-customer-access",
    authenticatedBy: "access",
  };
}

function createVerificationOfficerPrincipal() {
  return {
    user: {
      id: "officer-1",
      email: "officer@example.com",
      fullName: "Verification Officer",
      role: "VERIFICATION_OFFICER",
    },
    session: {
      id: "session-4",
    },
    accessToken: "officer-access",
    authenticatedBy: "access",
  };
}

function createTriggerMemoryStore() {
  const nominees = [
    {
      id: "nominee-1",
      customerId: "customer-1",
      nomineeUserId: "nominee-user-1",
      fullName: "Nominee User",
      email: "nominee@example.com",
      mobile: "+91 9999999999",
      relationship: "brother",
      customRelationship: null,
      status: "ACTIVE",
    },
    {
      id: "nominee-2",
      customerId: "customer-2",
      nomineeUserId: "nominee-user-2",
      fullName: "Other Nominee",
      email: "other@example.com",
      mobile: "+91 9888888888",
      relationship: "sister",
      customRelationship: null,
      status: "ACTIVE",
    },
  ];

  const requests = [];
  const proofs = [];
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
    {
      id: "document-2",
      customerId: "customer-1",
      categoryId: "category-2",
      documentTitle: "Insurance Policy",
      originalFileName: "insurance-policy.pdf",
      fileMimeType: "application/pdf",
      fileSize: 4096,
      status: "ACTIVE",
      updatedAt: "2026-06-01T11:00:00.000Z",
      createdAt: "2026-06-01T11:00:00.000Z",
    },
    {
      id: "document-3",
      customerId: "customer-2",
      categoryId: "category-3",
      documentTitle: "Other Customer Document",
      originalFileName: "other.pdf",
      fileMimeType: "application/pdf",
      fileSize: 1024,
      status: "ACTIVE",
      updatedAt: "2026-06-01T12:00:00.000Z",
      createdAt: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "document-4",
      customerId: "customer-1",
      categoryId: "category-4",
      documentTitle: "Family Will",
      originalFileName: "family-will.pdf",
      fileMimeType: "application/pdf",
      fileSize: 3072,
      status: "ACTIVE",
      updatedAt: "2026-06-01T13:00:00.000Z",
      createdAt: "2026-06-01T13:00:00.000Z",
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
      conditionNotes: "Identity proof required.",
      isActive: true,
      revokedAt: null,
      deletedAt: null,
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
      nomineeFullName: "Nominee User",
      nomineeEmail: "nominee@example.com",
      documentTitle: "Identity Certificate",
      categoryName: null,
      status: "ACTIVE",
    },
    {
      id: "rule-2",
      customerId: "customer-1",
      nomineeId: "nominee-1",
      documentId: null,
      categoryId: "category-2",
      canView: true,
      canDownload: true,
      releaseCondition: "ON_APPROVAL",
      conditionNotes: "Category-level access rule.",
      isActive: true,
      revokedAt: null,
      deletedAt: null,
      createdAt: "2026-06-01T10:05:00.000Z",
      updatedAt: "2026-06-01T10:05:00.000Z",
      nomineeFullName: "Nominee User",
      nomineeEmail: "nominee@example.com",
      documentTitle: null,
      categoryName: "Insurance",
      status: "ACTIVE",
    },
  ];
  const releases = [];
  const auditLogs = [];
  const securityEvents = [];

  function toSnapshot(row) {
    const nominee = nominees.find((item) => item.id === row.nomineeId);
    const requestProofs = proofs.filter((proof) => proof.triggerRequestId === row.id);
    const latestProof = requestProofs[0] ?? null;
    const document = row.documentId ? documents.find((item) => item.id === row.documentId) ?? null : null;
    const accessRule = document
      ? accessRules.find(
          (rule) =>
            rule.customerId === row.customerId &&
            rule.nomineeId === row.nomineeId &&
            rule.status === "ACTIVE" &&
            rule.isActive &&
            (rule.documentId === document.id || rule.categoryId === document.categoryId)
        ) ?? null
      : null;
    const accessRuleCanView = accessRule ? Boolean(accessRule.canView) : null;

    return {
      id: row.id,
      customerId: row.customerId,
      nomineeId: row.nomineeId,
      nomineeUserId: nominee?.nomineeUserId ?? null,
      nomineeName: nominee?.fullName ?? "Unknown nominee",
      nomineeEmail: nominee?.email ?? null,
      nomineeMobile: nominee?.mobile ?? null,
      relationship: nominee?.relationship ?? "brother",
      customRelationship: nominee?.customRelationship ?? null,
      documentId: row.documentId ?? null,
      documentTitle: row.documentTitle ?? null,
      accessRuleId: accessRule?.id ?? null,
      accessRuleScope: accessRule?.documentId ? "DOCUMENT" : accessRule?.categoryId ? "CATEGORY" : null,
      accessRuleCanView,
      accessRuleCanDownload: accessRule ? accessRuleCanView && Boolean(accessRule.canDownload) : null,
      accessRuleCondition: accessRule?.releaseCondition ?? null,
      accessRuleNotes: accessRule?.conditionNotes ?? null,
      requestKind: row.requestKind,
      subjectLine: row.subjectLine,
      summary: row.summary,
      priority: row.priority,
      status: row.status,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      resolvedAt: row.resolvedAt,
      cancelledAt: row.cancelledAt,
      additionalInfoRequestedAt: row.additionalInfoRequestedAt,
      additionalInfoReason: row.additionalInfoReason,
      adminDecisionNote: row.adminDecisionNote,
      latestActivityAt: row.latestActivityAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      proofCount: requestProofs.length,
      latestProofId: latestProof?.id ?? null,
      requestedByUserId: row.requestedByUserId,
      lastActionBy: row.lastActionBy,
      lastActionRole: row.lastActionRole,
    };
  }

  const store = {
    nominees,
    requests,
    proofs,
    releases,
    auditLogs,
    securityEvents,
    async findNomineeById(nomineeId) {
      return nominees.find((nominee) => nominee.id === nomineeId) ?? null;
    },
    async findNomineeByUserId(nomineeUserId) {
      return nominees.find((nominee) => nominee.nomineeUserId === nomineeUserId && nominee.status === "ACTIVE") ?? null;
    },
    async listRequestsByCustomer(customerId, filters) {
      return requests
        .filter((request) => request.customerId === customerId)
        .filter((request) => !filters?.status || request.status === filters.status)
        .filter((request) => !filters?.requestKind || request.requestKind === filters.requestKind)
        .filter((request) => !filters?.documentId || request.documentId === filters.documentId)
        .map(toSnapshot);
    },
    async listRequestsByNomineeUserId(nomineeUserId, filters) {
      return requests
        .filter((request) => nominees.find((nominee) => nominee.id === request.nomineeId && nominee.nomineeUserId === nomineeUserId))
        .filter((request) => !filters?.status || request.status === filters.status)
        .filter((request) => !filters?.requestKind || request.requestKind === filters.requestKind)
        .filter((request) => !filters?.documentId || request.documentId === filters.documentId)
        .map(toSnapshot);
    },
    async listRequestsForAdmin(filters) {
      return requests
        .filter((request) => !filters?.status || request.status === filters.status)
        .filter((request) => !filters?.requestKind || request.requestKind === filters.requestKind)
        .filter((request) => !filters?.documentId || request.documentId === filters.documentId)
        .map(toSnapshot);
    },
    async findRequestById(requestId) {
      const request = requests.find((item) => item.id === requestId);
      return request ? toSnapshot(request) : null;
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
        latestActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedByUserId: input.requestedByUserId,
        lastActionBy: input.requestedByUserId,
        lastActionRole: input.requestedByRole.toLowerCase(),
      };

      requests.unshift(request);
      return toSnapshot(request);
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
          categoryName: document.categoryId === "category-2" ? "Insurance" : "Identity",
          categoryDescription: null,
        }));
    },
    async findDocumentById(documentId) {
      const document = documents.find((item) => item.id === documentId);
      if (!document) {
        return null;
      }

      return {
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
        categoryName: document.categoryId === "category-2" ? "Insurance" : "Identity",
        categoryDescription: null,
      };
    },
    async findReleaseByComposite(input) {
      return (
        releases.find(
          (release) =>
            release.triggerRequestId === input.triggerRequestId &&
            release.nomineeId === input.nomineeId &&
            release.documentId === input.documentId
        ) ?? null
      );
    },
    async upsertRelease(input) {
      const nominee = nominees.find((item) => item.id === input.nomineeId);
      const document = documents.find((item) => item.id === input.documentId);
      const existing = releases.find(
        (release) =>
          release.triggerRequestId === input.triggerRequestId &&
          release.nomineeId === input.nomineeId &&
          release.documentId === input.documentId
      );
      const release = existing ?? {
        id: `release-${releases.length + 1}`,
        triggerRequestId: input.triggerRequestId,
        customerId: input.customerId,
        nomineeId: input.nomineeId,
        nomineeUserId: nominee?.nomineeUserId ?? null,
        nomineeName: nominee?.fullName ?? "Nominee User",
        nomineeEmail: nominee?.email ?? null,
        documentId: input.documentId,
        documentTitle: document?.documentTitle ?? "Document",
        fileName: document?.originalFileName ?? null,
        fileType: document?.fileMimeType ?? null,
        fileSize: document?.fileSize ?? null,
        releasedBy: "Verification Officer",
        releaseStatus: "RELEASED",
        releasedAt: new Date().toISOString(),
        revokedAt: null,
      };

      Object.assign(release, {
        releasedBy: input.releasedBy,
        canView: input.canView,
        canDownload: input.canDownload,
        releaseNotes: input.releaseNotes,
        releaseStatus: "RELEASED",
        releasedAt: release.releasedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (!existing) {
        releases.push(release);
      }

      return release;
    },
    async submitRequest(requestId, actorUserId, actorRole) {
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        return null;
      }

      Object.assign(request, {
        status: "PENDING",
        submittedAt: request.submittedAt ?? new Date().toISOString(),
        latestActivityAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActionBy: actorUserId,
        lastActionRole: actorRole,
      });

      return toSnapshot(request);
    },
    async updateRequestStatus(requestId, status, actorUserId, actorRole) {
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        return null;
      }

      Object.assign(request, {
        status,
        latestActivityAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActionBy: actorUserId,
        lastActionRole: actorRole,
      });

      return toSnapshot(request);
    },
    async updateRequestReview(requestId, status, actorUserId, actorRole, adminRemarks, additionalInfoReason) {
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        return null;
      }

      Object.assign(request, {
        status,
        adminDecisionNote: adminRemarks ?? request.adminDecisionNote,
        additionalInfoReason: additionalInfoReason ?? request.additionalInfoReason,
        reviewedAt: new Date().toISOString(),
        resolvedAt: status === "APPROVED" || status === "REJECTED" ? new Date().toISOString() : request.resolvedAt,
        additionalInfoRequestedAt: status === "ADDITIONAL_INFO_REQUIRED" ? new Date().toISOString() : request.additionalInfoRequestedAt,
        latestActivityAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActionBy: actorUserId,
        lastActionRole: actorRole,
      });

      return toSnapshot(request);
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
        uploadedAt: new Date().toISOString(),
      };

      proofs.unshift(proof);

      return {
        id: proof.id,
        triggerRequestId: proof.triggerRequestId,
        fileName: proof.originalFileName,
        fileType: proof.fileMimeType,
        fileSize: proof.fileSize,
        fileHash: proof.fileHash,
        notes: proof.notes,
        uploadedByUserId: proof.uploadedBy,
        uploadedByName: nominees.find((nominee) => nominee.nomineeUserId === proof.uploadedBy)?.fullName ?? "Nominee User",
        uploadedByRole: proof.uploadedByRole,
        verificationStatus: proof.verificationStatus,
        adminRemarks: proof.adminRemarks,
        createdAt: proof.uploadedAt,
        uploadPath: proof.encryptedFilePath,
      };
    },
    async listProofs(requestId) {
      return proofs
        .filter((proof) => proof.triggerRequestId === requestId)
        .map((proof) => ({
          id: proof.id,
          triggerRequestId: proof.triggerRequestId,
          fileName: proof.originalFileName,
          fileType: proof.fileMimeType,
          fileSize: proof.fileSize,
          fileHash: proof.fileHash,
          notes: proof.notes,
          uploadedByUserId: proof.uploadedBy,
          uploadedByName: nominees.find((nominee) => nominee.nomineeUserId === proof.uploadedBy)?.fullName ?? "Nominee User",
          uploadedByRole: proof.uploadedByRole,
          verificationStatus: proof.verificationStatus,
          adminRemarks: proof.adminRemarks,
          createdAt: proof.uploadedAt,
          uploadPath: proof.encryptedFilePath,
        }));
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
    async updateProofVerification(requestId, proofId, verificationStatus, adminUserId, adminRemarks) {
      const proof = proofs.find((item) => item.triggerRequestId === requestId && item.id === proofId);
      if (!proof) {
        return null;
      }

      Object.assign(proof, {
        verificationStatus,
        adminRemarks,
        verifiedBy: adminUserId,
        verifiedAt: new Date().toISOString(),
      });

      return {
        id: proof.id,
        triggerRequestId: proof.triggerRequestId,
        fileName: proof.originalFileName,
        fileType: proof.fileMimeType,
        fileSize: proof.fileSize,
        fileHash: proof.fileHash,
        notes: proof.notes,
        uploadedByUserId: proof.uploadedBy,
        uploadedByName: nominees.find((nominee) => nominee.nomineeUserId === proof.uploadedBy)?.fullName ?? "Nominee User",
        uploadedByRole: proof.uploadedByRole,
        verificationStatus: proof.verificationStatus,
        adminRemarks: proof.adminRemarks,
        createdAt: proof.uploadedAt,
        uploadPath: proof.encryptedFilePath,
      };
    },
    async createVerificationNote() {},
    async listTimeline(requestId) {
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        return [];
      }

      const requestProofs = proofs.filter((proof) => proof.triggerRequestId === requestId);
      const timeline = [
        {
          id: `timeline-${request.id}-created`,
          requestId: request.id,
          action: "Request created",
          status: "DRAFT",
          actorName: "Nominee User",
          actorRole: "nominee",
          summary: request.summary,
          createdAt: request.createdAt,
        },
      ];

      if (request.submittedAt) {
        timeline.push({
          id: `timeline-${request.id}-submitted`,
          requestId: request.id,
          action: "Request submitted",
          status: "PENDING",
          actorName: "Nominee User",
          actorRole: "nominee",
          summary: "Request entered the review queue.",
          createdAt: request.submittedAt,
        });
      }

      for (const proof of requestProofs) {
        timeline.push({
          id: `timeline-${proof.id}-proof`,
          requestId: request.id,
          action: "Proof uploaded",
          status: request.status,
          actorName: "Nominee User",
          actorRole: "nominee",
          summary: proof.notes ?? "Supporting proof uploaded.",
          createdAt: proof.uploadedAt,
        });
      }

      for (const proof of requestProofs.filter((item) => item.verifiedAt)) {
        timeline.push({
          id: `timeline-${proof.id}-proof-review`,
          requestId: request.id,
          action: proof.verificationStatus === "VERIFIED" ? "Proof verified" : "Proof rejected",
          status: request.status === "APPROVED" || request.status === "REJECTED" ? request.status : "UNDER_REVIEW",
          actorName: "Verification Officer",
          actorRole: "admin",
          summary: proof.adminRemarks ?? `${proof.originalFileName} marked ${proof.verificationStatus.toLowerCase()}.`,
          createdAt: proof.verifiedAt,
        });
      }

      if (request.additionalInfoRequestedAt) {
        timeline.push({
          id: `timeline-${request.id}-more-info`,
          requestId: request.id,
          action: "More information requested",
          status: "ADDITIONAL_INFO_REQUIRED",
          actorName: "Verification Officer",
          actorRole: "admin",
          summary: request.additionalInfoReason ?? "The officer requested more information before making a final decision.",
          createdAt: request.additionalInfoRequestedAt,
        });
      }

      if (request.resolvedAt && (request.status === "APPROVED" || request.status === "REJECTED")) {
        timeline.push({
          id: `timeline-${request.id}-${request.status.toLowerCase()}`,
          requestId: request.id,
          action: request.status === "APPROVED" ? "Request approved" : "Request rejected",
          status: request.status,
          actorName: "Verification Officer",
          actorRole: "admin",
          summary:
            request.adminDecisionNote ??
            (request.status === "APPROVED"
              ? "The trigger request was approved after proof review."
              : "The trigger request was rejected after proof review."),
          createdAt: request.resolvedAt,
        });
      }

      return timeline.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },
    async findUserById(userId) {
      if (userId === "nominee-user-1") {
        return {
          id: "nominee-user-1",
          fullName: "Nominee User",
          email: "nominee@example.com",
          mobile: null,
          passwordHash: "hash",
          role: "NOMINEE",
          status: "ACTIVE",
          isEmailVerified: true,
          isMobileVerified: true,
          mfaEnabled: false,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      if (userId === "customer-1") {
        return {
          id: "customer-1",
          fullName: "Customer Owner",
          email: "customer@example.com",
          mobile: null,
          passwordHash: "hash",
          role: "CUSTOMER",
          status: "ACTIVE",
          isEmailVerified: true,
          isMobileVerified: true,
          mfaEnabled: false,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return null;
    },
    async findNomineeAssignment(customerId, nomineeUserId) {
      return nominees.find((nominee) => nominee.customerId === customerId && nominee.nomineeUserId === nomineeUserId) ?? null;
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push(entry);
    },
    async createNotification() {},
    async listPermissionsForUser(userId) {
      if (userId === "nominee-user-1") {
        return ["NOMINEE_RAISE_TRIGGER", "NOMINEE_UPLOAD_PROOF", "NOMINEE_VIEW_TRIGGER_STATUS"];
      }

      if (userId === "customer-1") {
        return ["USER_VIEW_OWN_AUDIT_LOG"];
      }

      if (userId === "officer-1") {
        return ["VERIFICATION_VIEW_ASSIGNED_CASE", "VERIFICATION_REVIEW_PROOF", "VERIFICATION_ADD_REMARKS"];
      }

      return ["ADMIN_VIEW_TRIGGER_QUEUE"];
    },
  };

  return store;
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

async function withServer(dependencies, run) {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger, dependencies);

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("development trigger proof uploads can be opened by the issued view URL", async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), "inherix-trigger-proofs-"));
  const logger = createLogger("silent");
  const server = createBackendServer({ ...testEnv, DEV_LOCAL_UPLOADS_DIR: uploadRoot }, logger, {});

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const key = "customers/customer-1/trigger-requests/request-1/proofs/proof-1.pdf";
  const proofUrl = `${baseUrl}/api/v1/dev/uploads/trigger-proofs/${encodeURIComponent(key)}?fileName=identity-proof.pdf`;

  try {
    const uploadResponse = await fetch(proofUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: Buffer.from("%PDF-1.4 nominee proof"),
    });
    assert.equal(uploadResponse.status, 200);

    const viewResponse = await fetch(proofUrl);
    assert.equal(viewResponse.status, 200);
    assert.equal(viewResponse.headers.get("content-type"), "application/pdf");
    assert.match(viewResponse.headers.get("content-disposition") ?? "", /inline; filename="identity-proof\.pdf"/);
    assert.equal(await viewResponse.text(), "%PDF-1.4 nominee proof");

    const largeKey = "customers/customer-1/trigger-requests/request-1/proofs/proof-large.pdf";
    const largeProofUrl = `${baseUrl}/api/v1/dev/uploads/trigger-proofs/${encodeURIComponent(largeKey)}?fileName=large-proof.pdf`;
    const largeProof = Buffer.alloc(2 * 1024 * 1024, "a");
    const largeUploadResponse = await fetch(largeProofUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: largeProof,
    });
    assert.equal(largeUploadResponse.status, 200);

    const largeViewResponse = await fetch(largeProofUrl);
    assert.equal(largeViewResponse.status, 200);
    assert.equal(Number(largeViewResponse.headers.get("content-length")), largeProof.length);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test("trigger request flow supports submission and signed proof uploads", async () => {
  const store = createTriggerMemoryStore();
  const triggerService = createTriggerService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      trigger: {
        resolveAuthSnapshot: async () => createNomineePrincipal(),
        triggerService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/trigger-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestKind: "medical",
          subjectLine: "Hospital discharge review",
          summary: "Please review the discharge summary for controlled access.",
          priority: "High",
        }),
      });

      assert.equal(createResponse.status, 201);
      const createJson = await createResponse.json();
      assert.equal(createJson.data.request.id, "request-1");
      assert.equal(createJson.data.request.status, "DRAFT");

      const submitResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/submit`, {
        method: "POST",
      });

      assert.equal(submitResponse.status, 200);
      const submitJson = await submitResponse.json();
      assert.equal(submitJson.data.request.status, "PENDING");

      const proofResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "hospital-summary.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          notes: "Discharge summary and doctor note.",
        }),
      });

      assert.equal(proofResponse.status, 201);
      const proofJson = await proofResponse.json();
      assert.equal(proofJson.data.proof.fileName, "hospital-summary.pdf");
      assert.ok(proofJson.data.upload.url.includes("uploads.example"));

      const detailResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1`);
      assert.equal(detailResponse.status, 200);
      const detailJson = await detailResponse.json();
      assert.equal(detailJson.data.request.status, "UNDER_REVIEW");
      assert.equal(detailJson.data.proofs.length, 1);
      assert.equal(detailJson.data.timeline.length >= 3, true);

      assert.deepEqual(store.auditLogs.map((entry) => entry.action), [
        "TRIGGER_REQUEST_CREATED",
        "TRIGGER_REQUEST_SUBMITTED",
        "TRIGGER_PROOF_UPLOADED",
      ]);
    }
  );
});

test("failed proof uploads can be cancelled before officer review", async () => {
  const store = createTriggerMemoryStore();
  const triggerService = createTriggerService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      trigger: {
        resolveAuthSnapshot: async (request) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (url.pathname.endsWith("/verify")) {
            return createVerificationOfficerPrincipal();
          }

          return createNomineePrincipal();
        },
        triggerService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/trigger-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestKind: "document-access",
          documentId: "document-1",
          subjectLine: "Need identity certificate",
          summary: "Please review my proof for this document.",
          priority: "High",
        }),
      });
      assert.equal(createResponse.status, 201);

      const proofResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "failed-upload.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          notes: "This upload will be cancelled.",
        }),
      });
      assert.equal(proofResponse.status, 201);
      assert.equal(store.proofs.length, 1);

      const deleteResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs/proof-1`, {
        method: "DELETE",
      });
      assert.equal(deleteResponse.status, 200);
      assert.equal(store.proofs.length, 0);

      const reviewedProofResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "reviewed-upload.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          notes: "This upload will be reviewed.",
        }),
      });
      assert.equal(reviewedProofResponse.status, 201);

      const verifyResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs/proof-1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationStatus: "VERIFIED",
          adminRemarks: "Reviewed.",
        }),
      });
      assert.equal(verifyResponse.status, 200);

      const deleteReviewedResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs/proof-1`, {
        method: "DELETE",
      });
      assert.equal(deleteReviewedResponse.status, 404);
      assert.equal(store.proofs.length, 1);
      assert.ok(store.auditLogs.some((entry) => entry.action === "TRIGGER_PROOF_UPLOAD_CANCELLED"));
    }
  );
});

test("document access requests are limited to eligible documents and audited", async () => {
  const store = createTriggerMemoryStore();
  const triggerService = createTriggerService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      trigger: {
        resolveAuthSnapshot: async () => createNomineePrincipal(),
        triggerService,
      },
    },
    async (baseUrl) => {
      const eligibleResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/document-access/eligible-documents`);
      assert.equal(eligibleResponse.status, 200);
      const eligibleJson = await eligibleResponse.json();

      assert.equal(eligibleJson.data.documents.length, 2);
      assert.equal(eligibleJson.data.documents[0].documentId, "document-1");
      assert.equal(eligibleJson.data.documents[1].documentId, "document-2");
      assert.equal(eligibleJson.data.documents[0].requestStatus, null);

      const createResponse = await fetch(`${baseUrl}/api/v1/trigger-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestKind: "document-access",
          documentId: "document-1",
          subjectLine: "Request access to Identity Certificate",
          summary: "Please review my eligibility for the identity certificate.",
          priority: "Medium",
        }),
      });

      assert.equal(createResponse.status, 201);
      const createJson = await createResponse.json();
      assert.equal(createJson.data.request.documentId, "document-1");
      assert.equal(createJson.data.request.requestKind, "document-access");

      const statusResponse = await fetch(`${baseUrl}/api/v1/trigger-requests?requestKind=document-access&documentId=document-1`);
      assert.equal(statusResponse.status, 200);
      const statusJson = await statusResponse.json();
      assert.equal(statusJson.data.requests.length, 1);
      assert.equal(statusJson.data.requests[0].documentId, "document-1");

      const proofResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "identity-proof.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          notes: "Identity proof for document access.",
        }),
      });

      assert.equal(proofResponse.status, 201);

      const auditActions = store.auditLogs.map((entry) => entry.action);
      assert.ok(auditActions.includes("TRIGGER_REQUEST_CREATED"));
      assert.ok(auditActions.includes("TRIGGER_PROOF_UPLOADED"));
    }
  );
});

test("verification officers can preview linked documents and keep proof verification state consistent", async () => {
  const store = createTriggerMemoryStore();
  const triggerService = createTriggerService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      trigger: {
        resolveAuthSnapshot: async (request) => {
          const url = new URL(request.url ?? "/", "http://localhost");

          if (
            url.pathname.endsWith("/document/preview") ||
            (url.pathname.includes("/proofs/") && url.pathname.endsWith("/verify")) ||
            url.pathname.endsWith("/approve") ||
            url.pathname.endsWith("/reject") ||
            url.pathname.endsWith("/more-info")
          ) {
            return createVerificationOfficerPrincipal();
          }

          if (request.method === "POST") {
            return createNomineePrincipal();
          }

          return createVerificationOfficerPrincipal();
        },
        triggerService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/trigger-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestKind: "document-access",
          documentId: "document-1",
          subjectLine: "Request access to Identity Certificate",
          summary: "Please review my eligibility for the identity certificate.",
          priority: "Medium",
        }),
      });

      assert.equal(createResponse.status, 201);

      const proofResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "identity-proof.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          notes: "Identity proof for document access.",
        }),
      });

      assert.equal(proofResponse.status, 201);

      const previewResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/document/preview`);
      assert.equal(previewResponse.status, 200);
      const previewJson = await previewResponse.json();
      assert.equal(previewJson.data.document.documentId, "document-1");
      assert.ok(previewJson.data.preview.url.includes("downloads.example"));

      const verifyResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/proofs/proof-1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationStatus: "VERIFIED",
          adminRemarks: "Document verified.",
        }),
      });

      assert.equal(verifyResponse.status, 200);
      const verifyJson = await verifyResponse.json();
      assert.equal(verifyJson.data.request.status, "UNDER_REVIEW");
      assert.equal(verifyJson.data.proof.verificationStatus, "VERIFIED");

      assert.ok(store.auditLogs.some((entry) => entry.action === "TRIGGER_REQUEST_DOCUMENT_PREVIEW_ISSUED"));
      assert.ok(store.auditLogs.some((entry) => entry.action === "TRIGGER_PROOF_VERIFIED"));
      assert.equal(store.proofs[0].verificationStatus, "VERIFIED");
      assert.equal(store.requests[0].status, "UNDER_REVIEW");

      const timelineAfterProofResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1`);
      assert.equal(timelineAfterProofResponse.status, 200);
      const timelineAfterProofJson = await timelineAfterProofResponse.json();
      assert.ok(timelineAfterProofJson.data.timeline.some((entry) => entry.action === "Proof verified"));

      const approveResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminRemarks: "Approved after verified proof.",
        }),
      });

      const approveBody = await approveResponse.text();
      assert.equal(approveResponse.status, 200, approveBody);
      const approvedDetailResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1`);
      assert.equal(approvedDetailResponse.status, 200);
      const approvedDetailJson = await approvedDetailResponse.json();
      assert.equal(approvedDetailJson.data.request.status, "APPROVED");
      assert.equal(approvedDetailJson.data.request.accessRuleId, "rule-1");
      assert.equal(approvedDetailJson.data.request.accessRuleCanView, true);
      assert.equal(approvedDetailJson.data.request.accessRuleCanDownload, false);
      assert.ok(approvedDetailJson.data.timeline.some((entry) => entry.action === "Request approved"));
      assert.equal(store.releases.length, 1);
      assert.equal(store.releases[0].documentId, "document-1");
      assert.equal(store.releases[0].canView, true);
      assert.equal(store.releases[0].canDownload, false);

      const secondApproveResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminRemarks: "Approved again without duplicate release.",
        }),
      });
      const secondApproveBody = await secondApproveResponse.text();
      assert.equal(secondApproveResponse.status, 200, secondApproveBody);
      assert.equal(store.releases.length, 1);
      assert.equal(store.auditLogs.some((entry) => entry.action === "DOCUMENT_RELEASE_CREATED"), true);
      assert.equal(store.auditLogs.some((entry) => entry.action === "DOCUMENT_RELEASE_UPDATED"), true);
    }
  );
});

test("document access eligibility is nominee-only", async () => {
  const store = createTriggerMemoryStore();
  const triggerService = createTriggerService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      trigger: {
        resolveAuthSnapshot: async () => createCustomerPrincipal(),
        triggerService,
      },
    },
    async (baseUrl) => {
      const eligibleResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/document-access/eligible-documents`);
      assert.equal(eligibleResponse.status, 403);
    }
  );
});

test("requested document preview is denied to customers", async () => {
  const store = createTriggerMemoryStore();
  const triggerService = createTriggerService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      trigger: {
        resolveAuthSnapshot: async (request) => {
          const url = new URL(request.url ?? "/", "http://localhost");

          if (request.method === "POST" && url.pathname === "/api/v1/trigger-requests") {
            return createNomineePrincipal();
          }

          return createCustomerPrincipal();
        },
        triggerService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/trigger-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestKind: "document-access",
          documentId: "document-1",
          subjectLine: "Request access to Identity Certificate",
          summary: "Please review my eligibility for the identity certificate.",
          priority: "Medium",
        }),
      });

      assert.equal(createResponse.status, 201);

      const previewResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1/document/preview`);
      assert.equal(previewResponse.status, 403);
    }
  );
});

test("trigger requests are scoped to the owning nominee or customer", async () => {
  const store = createTriggerMemoryStore();
  const triggerService = createTriggerService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      trigger: {
        resolveAuthSnapshot: async (request) => {
          const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname.endsWith("/trigger-requests") && request.method === "POST") {
        return createNomineePrincipal();
      }

      return createOtherCustomerPrincipal();
        },
        triggerService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/trigger-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestKind: "legal",
          subjectLine: "Court order notice",
          summary: "Owner-assisted request for a different nominee should be rejected.",
          priority: "Medium",
        }),
      });

      assert.equal(createResponse.status, 201);

      const forbiddenResponse = await fetch(`${baseUrl}/api/v1/trigger-requests/request-1`, {
        method: "GET",
      });

      assert.equal(forbiddenResponse.status, 404);
    }
  );
});
