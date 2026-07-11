import { backendJsonFetch } from "@/lib/auth-state";
import { parseBackendJsonResponse } from "@/lib/backend-api";
import type { TriggerProof } from "@/lib/trigger-api";

export type ReleaseRequestRecord = {
  id: string;
  customerId: string;
  nomineeId: string;
  nomineeUserId: string | null;
  nomineeName: string;
  nomineeEmail: string | null;
  relationship: string;
  customRelationship: string | null;
  requestKind: "death" | "medical" | "legal" | "court-order" | "other";
  subjectLine: string;
  summary: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "DRAFT" | "PENDING" | "UNDER_REVIEW" | "ADDITIONAL_INFO_REQUIRED" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewedAt: string | null;
  resolvedAt: string | null;
  latestActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ReleaseQueueSummary = {
  request: ReleaseRequestRecord;
  eligibleDocumentCount: number;
  releasedDocumentCount: number;
  verifiedProofCount: number;
};

export type ReleaseDocumentCandidate = {
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
  releaseId: string | null;
  releaseStatus: "PENDING" | "RELEASED" | "REVOKED";
  releaseNotes: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
};

export type ReleaseRecord = {
  id: string;
  triggerRequestId: string;
  customerId: string;
  nomineeId: string;
  nomineeName: string;
  nomineeUserId: string | null;
  documentId: string;
  documentTitle: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  categoryId: string;
  categoryName: string;
  canView: boolean;
  canDownload: boolean;
  releaseStatus: "PENDING" | "RELEASED" | "REVOKED";
  releaseNotes: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReleaseNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
  status: "PENDING" | "SENT" | "FAILED";
  readAt: string | null;
  createdAt: string;
};

export type ReleasedDocumentAccessLog = {
  id: string;
  releaseId: string;
  triggerRequestId: string;
  customerId: string;
  nomineeId: string;
  documentId: string;
  documentTitle: string;
  action: "VIEWED" | "DOWNLOADED" | "FAILED_ACCESS";
  actorName: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  accessedAt: string;
};

export async function listReleaseQueue() {
  const response = await backendJsonFetch("/releases");
  return parseBackendJsonResponse<{
    requests: ReleaseQueueSummary[];
    notifications: ReleaseNotification[];
    releases?: ReleaseRecord[];
    accessLogs?: ReleasedDocumentAccessLog[];
  }>(
    response,
    "The backend request could not be completed."
  );
}

export async function getReleaseQueueRequest(requestId: string) {
  const response = await backendJsonFetch(`/releases/${encodeURIComponent(requestId)}`);
  return parseBackendJsonResponse<{
    request: ReleaseRequestRecord;
    documents: ReleaseDocumentCandidate[];
    releases: ReleaseRecord[];
    proofs: TriggerProof[];
  }>(response, "The backend request could not be completed.");
}

export async function createOrUpdateRelease(input: {
  triggerRequestId: string;
  documentId: string;
  canView: boolean;
  canDownload: boolean;
  releaseNotes?: string | null;
}) {
  const response = await backendJsonFetch("/releases", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      releaseNotes: input.releaseNotes ?? null,
    }),
  });

  return parseBackendJsonResponse<{ request: ReleaseRequestRecord; release: ReleaseRecord }>(
    response,
    "The backend request could not be completed."
  );
}

export async function revokeRelease(releaseId: string, notes?: string | null) {
  const response = await backendJsonFetch(`/releases/${encodeURIComponent(releaseId)}/revoke`, {
    method: "POST",
    body: JSON.stringify({ notes: notes ?? null }),
  });

  return parseBackendJsonResponse<{ release: ReleaseRecord }>(response, "The backend request could not be completed.");
}

export async function listReleasedDocuments() {
  const response = await backendJsonFetch("/released-documents");
  return parseBackendJsonResponse<{
    releases: ReleaseRecord[];
    notifications: ReleaseNotification[];
    accessLogs: ReleasedDocumentAccessLog[];
  }>(response, "The backend request could not be completed.");
}

export async function requestReleasedDocumentAccess(input: {
  releaseId: string;
  action: "view" | "download";
}) {
  const response = await backendJsonFetch(`/released-documents/${encodeURIComponent(input.releaseId)}/access`, {
    method: "POST",
    body: JSON.stringify({ action: input.action }),
  });

  return parseBackendJsonResponse<{
    release: ReleaseRecord;
    download: { url: string; expiresAt: string; requiredHeaders: Record<string, string> };
  }>(response, "The backend request could not be completed.");
}
