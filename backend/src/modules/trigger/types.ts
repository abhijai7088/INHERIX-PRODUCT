import type { UserRole } from "../auth/types.js";

export type TriggerRequestKind = "death" | "medical" | "legal" | "court-order" | "other" | "document-access";

export type TriggerRequestPriority = "Low" | "Medium" | "High" | "Critical";

export type TriggerRequestStatus =
  | "DRAFT"
  | "PENDING"
  | "UNDER_REVIEW"
  | "ADDITIONAL_INFO_REQUIRED"
  | "PENDING_SUPER_ADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type TriggerActorRole = "customer" | "nominee" | "admin" | "system";

export type TriggerPrincipal = {
  user: {
    id: string;
    email: string;
    fullName?: string;
    role: UserRole;
  };
  session: { id: string } | null;
  accessToken: string;
  authenticatedBy: "access" | "refresh";
};

export type TriggerRequestRecord = {
  id: string;
  customerId: string;
  customerName: string;
  nomineeId: string;
  nomineeUserId: string | null;
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
  superAdminDecisionNote: string | null;
  superAdminReviewedAt: string | null;
  latestActivityAt: string;
  createdAt: string;
  updatedAt: string;
  proofCount: number;
  requestedByUserId: string | null;
  lastActionByUserId: string | null;
  lastActionByName: string | null;
  lastActionRole: TriggerActorRole;
};

export type TriggerProofRecord = {
  id: string;
  requestId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string | null;
  notes: string | null;
  uploadedBy: string | null;
  uploadedByRole: TriggerActorRole;
  verificationStatus: "UPLOADED" | "VERIFIED" | "REJECTED";
  adminRemarks: string | null;
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

export type TriggerEligibleDocumentRecord = {
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
  requestKind: TriggerRequestKind | null;
  proofCount: number;
  latestProofStatus: "UPLOADED" | "VERIFIED" | "REJECTED" | null;
  latestProofAt: string | null;
  releaseId: string | null;
  releaseStatus: "PENDING" | "RELEASED" | "REVOKED" | null;
  releaseNotes: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
  latestActivityAt: string;
};

export type TriggerRequestCreateInput = {
  nomineeId?: string | null;
  documentId?: string | null;
  requestKind: TriggerRequestKind;
  subjectLine: string;
  summary: string;
  priority: TriggerRequestPriority;
};

export type TriggerProofCreateInput = {
  requestId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash?: string | null;
  notes?: string | null;
};

export type TriggerUploadTicket = {
  proof: TriggerProofRecord;
  upload: {
    url: string;
    expiresAt: string;
    requiredHeaders: Record<string, string>;
  };
};

export type TriggerDocumentPreviewRecord = {
  documentId: string;
  documentTitle: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
};

export type TriggerDocumentPreviewTicket = {
  document: TriggerDocumentPreviewRecord;
  preview: {
    url: string;
    expiresAt: string;
    requiredHeaders: Record<string, string>;
  };
};
