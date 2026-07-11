import type { TriggerRequestKind, TriggerRequestPriority, TriggerRequestStatus } from "../trigger/types.js";
import type { TriggerActorRole } from "../trigger/types.js";
import type { UserRole } from "../auth/types.js";

export type ReleaseRequestRecord = {
  id: string;
  customerId: string;
  nomineeId: string;
  nomineeUserId: string | null;
  nomineeName: string;
  nomineeEmail: string | null;
  relationship: string;
  customRelationship: string | null;
  requestKind: TriggerRequestKind;
  subjectLine: string;
  summary: string;
  priority: TriggerRequestPriority;
  status: TriggerRequestStatus;
  reviewedAt: string | null;
  resolvedAt: string | null;
  latestActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ReleaseProofRecord = {
  id: string;
  requestId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  notes: string | null;
  verificationStatus: "UPLOADED" | "VERIFIED" | "REJECTED";
  adminRemarks: string | null;
  uploadedBy: string | null;
  uploadedByRole: TriggerActorRole;
  createdAt: string;
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

export type ReleasedDocumentAccessLogRecord = {
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

export type ReleaseNotificationRecord = {
  id: string;
  userId: string;
  title: string;
  message: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
  status: "PENDING" | "SENT" | "FAILED";
  readAt: string | null;
  sentAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ReleasePrincipal = {
  user: {
    id: string;
    email: string;
    role: UserRole;
    fullName?: string;
  };
  session: { id: string } | null;
  accessToken: string;
  authenticatedBy: "access" | "refresh";
};

export type ReleaseAccessAction = "view" | "download";

export type ReleaseAccessTicket = {
  release: ReleaseRecord;
  download: {
    url: string;
    expiresAt: string;
    requiredHeaders: Record<string, string>;
  };
};

export type ReleaseQueueSummary = {
  request: ReleaseRequestRecord;
  eligibleDocumentCount: number;
  releasedDocumentCount: number;
  verifiedProofCount: number;
};
