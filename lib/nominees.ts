import { backendJsonFetch } from "./auth-state";
import { parseBackendJsonResponse } from "./backend-api";

export type NomineeApiRecord = {
  id: string;
  customerId: string;
  customerName?: string | null;
  nomineeUserId: string | null;
  fullName: string;
  email: string | null;
  mobile: string | null;
  relationship: string;
  customRelationship: string | null;
  notes: string | null;
  status: "INVITED" | "ACTIVE" | "REJECTED" | "REMOVED";
  verificationStatus: string;
  invitationStatus: "SENT" | "PENDING" | "ACCEPTED" | "REMOVED";
  invitedAt: string;
  acceptedAt: string | null;
  removedAt: string | null;
  updatedAt: string;
  assignedCount: number;
  assignedDocuments?: Array<{
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
  }>;
};

export type NomineeListResponse = {
  nominees: NomineeApiRecord[];
};

export type NomineeDetailResponse = {
  nominee: NomineeApiRecord;
};

export type CurrentNomineeResponse = {
  nominee: NomineeApiRecord;
};

export type NomineeAcceptResponse = {
  nominee: NomineeApiRecord;
  accessToken: string | null;
  nextPath: string;
};

export type NomineeInvitationContextResponse = {
  invitation: {
    fullName: string;
    email: string | null;
    expiresAt: string | null;
    isExpired: boolean;
    invitationStatus: string;
  };
};

type NomineeInviteInput = {
  fullName: string;
  email: string;
  mobile: string;
  relationship: string;
  customRelationship?: string | null;
  notes?: string | null;
};

type NomineeUpdateInput = {
  fullName?: string | null;
  email?: string | null;
  mobile?: string | null;
  relationship?: string | null;
  customRelationship?: string | null;
  notes?: string | null;
};

export async function loadNominees() {
  const response = await backendJsonFetch("/nominees");
  return parseBackendJsonResponse<NomineeListResponse>(response, "The nominee request could not be completed.");
}

export async function loadNominee(nomineeId: string) {
  const response = await backendJsonFetch(`/nominees/${encodeURIComponent(nomineeId)}`);
  return parseBackendJsonResponse<NomineeDetailResponse>(response, "The nominee request could not be completed.");
}

export async function loadCurrentNominee() {
  const response = await backendJsonFetch("/nominees/me");
  return parseBackendJsonResponse<CurrentNomineeResponse>(response, "The nominee request could not be completed.");
}

export async function createNominee(input: NomineeInviteInput) {
  const response = await backendJsonFetch("/nominees", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return parseBackendJsonResponse<NomineeDetailResponse>(response, "The nominee request could not be completed.");
}

export async function updateNominee(nomineeId: string, input: NomineeUpdateInput) {
  const response = await backendJsonFetch(`/nominees/${encodeURIComponent(nomineeId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return parseBackendJsonResponse<NomineeDetailResponse>(response, "The nominee request could not be completed.");
}

export async function resendNomineeInvitation(nomineeId: string) {
  const response = await backendJsonFetch(`/nominees/${encodeURIComponent(nomineeId)}/resend-invite`, {
    method: "POST",
  });

  return parseBackendJsonResponse<NomineeDetailResponse>(response, "The nominee request could not be completed.");
}

export async function removeNominee(nomineeId: string) {
  const response = await backendJsonFetch(`/nominees/${encodeURIComponent(nomineeId)}`, {
    method: "DELETE",
  });

  return parseBackendJsonResponse<NomineeDetailResponse>(response, "The nominee request could not be completed.");
}

export async function acceptNomineeInvitation(token: string) {
  const response = await backendJsonFetch("/nominees/accept-invitation", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

  return parseBackendJsonResponse<NomineeAcceptResponse>(response, "The nominee request could not be completed.");
}

export async function loadNomineeInvitationContext(token: string) {
  const response = await backendJsonFetch(`/nominees/invitation-context?token=${encodeURIComponent(token)}`);
  return parseBackendJsonResponse<NomineeInvitationContextResponse>(response, "The nominee request could not be completed.");
}

export async function resendExpiredNomineeInvitation(token: string) {
  const response = await backendJsonFetch("/nominees/invitation-context/resend", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

  return parseBackendJsonResponse<NomineeAcceptResponse | { resend: { email: string | null; expiresAt: string | null; nominee: NomineeApiRecord } }>(
    response,
    "The nominee request could not be completed."
  );
}
