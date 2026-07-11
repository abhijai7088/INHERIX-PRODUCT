import type { UserRole } from "../auth/types.js";

export type NomineeStatus = "INVITED" | "ACTIVE" | "REJECTED" | "REMOVED";

export type NomineeRecord = {
  id: string;
  customerId: string;
  nomineeUserId: string | null;
  fullName: string;
  email: string | null;
  mobile: string | null;
  relationship: string;
  customRelationship: string | null;
  notes: string | null;
  status: NomineeStatus;
  verificationStatus: string;
  invitationTokenHash: string | null;
  invitationExpiresAt: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NomineeViewRecord = NomineeRecord & {
  invitationStatus: "SENT" | "PENDING" | "ACCEPTED" | "REMOVED";
  assignedCount: number;
};

export type NomineeAssignedDocumentRecord = {
  ruleId: string;
  documentId: string;
  documentTitle: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  categoryId: string;
  categoryName: string;
  canView: boolean;
  canDownload: boolean;
  releaseCondition: string;
  conditionNotes: string | null;
  documentUpdatedAt: string;
};

export type NomineeInviteInput = {
  fullName: string;
  email: string;
  mobile: string;
  relationship: string;
  customRelationship: string | null;
  notes: string | null;
};

export type NomineeUpdateInput = {
  fullName?: string | null;
  email?: string | null;
  mobile?: string | null;
  relationship?: string | null;
  customRelationship?: string | null;
  notes?: string | null;
};

export type NomineeInvitationClaim = {
  userId: string;
  userEmail: string;
  userRole: UserRole;
};
