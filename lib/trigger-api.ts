import { backendJsonFetch } from "@/lib/auth-state";
import { parseBackendJsonResponse } from "@/lib/backend-api";
import type { TriggerProofStatus } from "@/lib/trigger-workflow";

export type TriggerRequestKind = "death" | "medical" | "legal" | "court-order" | "other" | "document-access";
export type TriggerRequestKindWithDocumentAccess = TriggerRequestKind;
export type TriggerRequestPriority = "Low" | "Medium" | "High" | "Critical";
export type TriggerRequestStatus =
  | "DRAFT"
  | "PENDING"
  | "UNDER_REVIEW"
  | "ADDITIONAL_INFO_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type TriggerActorRole = "customer" | "nominee" | "admin" | "system";

export type TriggerProof = {
  id: string;
  requestId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string | null;
  notes: string | null;
  verificationStatus: TriggerProofStatus;
  adminRemarks: string | null;
  uploadedBy: string | null;
  uploadedByRole: TriggerActorRole;
  createdAt: string;
};

export type TriggerTimelineEntry = {
  id: string;
  requestId: string;
  action: string;
  status: TriggerRequestStatus;
  actorName: string;
  actorRole: TriggerActorRole;
  summary: string;
  createdAt: string;
};

export type TriggerRequest = {
  id: string;
  customerId: string;
  customerName: string;
  nomineeId: string;
  documentId: string | null;
  documentTitle: string | null;
  accessRuleId: string | null;
  accessRuleScope: "DOCUMENT" | "CATEGORY" | null;
  accessRuleCanView: boolean | null;
  accessRuleCanDownload: boolean | null;
  accessRuleCondition: string | null;
  accessRuleNotes: string | null;
  nomineeName: string;
  nomineeEmail: string | null;
  nomineeMobile: string | null;
  relationship: string;
  customRelationship: string | null;
  requestKind: TriggerRequestKind;
  subjectLine: string;
  summary: string;
  priority: TriggerRequestPriority;
  status: TriggerRequestStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  additionalInfoRequestedAt: string | null;
  additionalInfoReason: string | null;
  adminDecisionNote: string | null;
  latestActivityAt: string;
  createdAt: string;
  updatedAt: string;
  proofCount: number;
  latestProofId: string | null;
  requestedByUserId: string | null;
  lastActionBy: string | null;
  lastActionRole: TriggerActorRole;
};

export type TriggerEligibleDocument = {
  documentId: string;
  documentTitle: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  categoryId: string;
  categoryName: string;
  canView: boolean;
  canDownload: boolean;
  releaseCondition: string | null;
  conditionNotes: string | null;
  requestId: string | null;
  requestStatus: TriggerRequestStatus | null;
  requestKind: TriggerRequestKindWithDocumentAccess | null;
  proofCount: number;
  latestProofStatus: TriggerProofStatus | null;
  latestProofAt: string | null;
  releaseId: string | null;
  releaseStatus: "PENDING" | "RELEASED" | "REVOKED" | null;
  releaseNotes: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
  latestActivityAt: string;
};

export type TriggerDocumentPreview = {
  document: {
    documentId: string;
    documentTitle: string;
    fileName: string | null;
    fileType: string | null;
    fileSize: number | null;
  };
  preview: {
    url: string;
    expiresAt: string;
    requiredHeaders: Record<string, string>;
  };
};

export type TriggerDetail = {
  request: TriggerRequest;
  proofs: TriggerProof[];
  timeline: TriggerTimelineEntry[];
};

export type TriggerRequestWithRelations = TriggerRequest & {
  proofs: TriggerProof[];
  timeline: TriggerTimelineEntry[];
};

export async function getCurrentUser() {
  const response = await backendJsonFetch("/auth/me");
  return parseBackendJsonResponse<{
    user: { id: string; fullName: string; email: string; role: string; isEmailVerified: boolean; mustResetPassword: boolean };
    permissions: string[];
    accessToken: string | null;
    sessionId: string | null;
    nextPath: string;
  }>(response, "The backend request could not be completed.");
}

export async function listTriggerRequests(status?: TriggerRequestStatus | null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await backendJsonFetch(`/trigger-requests${query}`);
  return parseBackendJsonResponse<{ requests: TriggerRequest[] }>(response, "The backend request could not be completed.");
}

export async function listTriggerRequestsByQuery(input?: {
  status?: TriggerRequestStatus | null;
  requestKind?: TriggerRequestKindWithDocumentAccess | null;
  documentId?: string | null;
}) {
  const searchParams = new URLSearchParams();
  if (input?.status) {
    searchParams.set("status", input.status);
  }
  if (input?.requestKind) {
    searchParams.set("requestKind", input.requestKind);
  }
  if (input?.documentId) {
    searchParams.set("documentId", input.documentId);
  }
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const response = await backendJsonFetch(`/trigger-requests${query}`);
  return parseBackendJsonResponse<{ requests: TriggerRequest[] }>(response, "The backend request could not be completed.");
}

export async function listEligibleDocumentRequests() {
  const response = await backendJsonFetch("/trigger-requests/document-access/eligible-documents");
  return parseBackendJsonResponse<{ documents: TriggerEligibleDocument[] }>(
    response,
    "The backend request could not be completed."
  );
}

export async function getTriggerRequest(requestId: string) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}`);
  return parseBackendJsonResponse<TriggerDetail>(response, "The backend request could not be completed.");
}

export async function createTriggerRequest(input: {
  nomineeId?: string | null;
  documentId?: string | null;
  requestKind: TriggerRequestKindWithDocumentAccess;
  subjectLine: string;
  summary: string;
  priority: TriggerRequestPriority;
}) {
  const response = await backendJsonFetch("/trigger-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return parseBackendJsonResponse<{ request: TriggerRequestWithRelations }>(
    response,
    "The backend request could not be completed."
  );
}

export async function submitTriggerRequest(requestId: string) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/submit`, {
    method: "POST",
  });

  return parseBackendJsonResponse<{ request: TriggerRequestWithRelations }>(
    response,
    "The backend request could not be completed."
  );
}

export async function prepareTriggerProofUpload(input: {
  requestId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash?: string | null;
  notes?: string | null;
}) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(input.requestId)}/proofs`, {
    method: "POST",
    body: JSON.stringify({
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      fileHash: input.fileHash ?? null,
      notes: input.notes ?? null,
    }),
  });

  return parseBackendJsonResponse<{
    proof: TriggerProof;
    upload: { url: string; expiresAt: string; requiredHeaders: Record<string, string> };
  }>(response, "The backend request could not be completed.");
}

export async function listTriggerProofs(requestId: string) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/proofs`);
  return parseBackendJsonResponse<{ proofs: TriggerProof[] }>(response, "The backend request could not be completed.");
}

export async function getTriggerRequestedDocumentPreview(requestId: string) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/document/preview`);
  return parseBackendJsonResponse<TriggerDocumentPreview>(response, "The backend request could not be completed.");
}

export async function listTriggerTimeline(requestId: string) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/timeline`);
  return parseBackendJsonResponse<{ timeline: TriggerTimelineEntry[] }>(response, "The backend request could not be completed.");
}

export async function getTriggerProofDownload(requestId: string, proofId: string) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/proofs/${encodeURIComponent(proofId)}/download`);
  return parseBackendJsonResponse<{ download: { url: string; expiresAt: string; requiredHeaders: Record<string, string> } }>(
    response,
    "The backend request could not be completed."
  );
}

export async function deleteUnreviewedTriggerProof(requestId: string, proofId: string) {
  const response = await backendJsonFetch(
    `/trigger-requests/${encodeURIComponent(requestId)}/proofs/${encodeURIComponent(proofId)}`,
    {
      method: "DELETE",
    }
  );

  return parseBackendJsonResponse<{ request: TriggerRequestWithRelations }>(
    response,
    "The backend request could not be completed."
  );
}

export async function verifyTriggerProof(input: {
  requestId: string;
  proofId: string;
  verificationStatus: "VERIFIED" | "REJECTED";
  adminRemarks?: string | null;
}) {
  const response = await backendJsonFetch(
    `/trigger-requests/${encodeURIComponent(input.requestId)}/proofs/${encodeURIComponent(input.proofId)}/verify`,
    {
      method: "POST",
      body: JSON.stringify({
        verificationStatus: input.verificationStatus,
        adminRemarks: input.adminRemarks ?? null,
      }),
    }
  );

  return parseBackendJsonResponse<{ request: TriggerRequestWithRelations; proof: TriggerProof }>(
    response,
    "The backend request could not be completed."
  );
}

export async function requestTriggerMoreInfo(requestId: string, reason: string) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/more-info`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

  return parseBackendJsonResponse<{ request: TriggerRequestWithRelations }>(
    response,
    "The backend request could not be completed."
  );
}

export async function approveTriggerRequest(requestId: string, adminRemarks?: string | null) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ adminRemarks: adminRemarks ?? null }),
  });

  return parseBackendJsonResponse<{ request: TriggerRequestWithRelations }>(
    response,
    "The backend request could not be completed."
  );
}

export async function rejectTriggerRequest(requestId: string, adminRemarks?: string | null) {
  const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ adminRemarks: adminRemarks ?? null }),
  });

  return parseBackendJsonResponse<{ request: TriggerRequestWithRelations }>(
    response,
    "The backend request could not be completed."
  );
}
