import { backendJsonFetch } from "@/lib/auth-state";
import { parseBackendJsonResponse } from "@/lib/backend-api";

export {
  PROFILE_SECTION_IDS,
  PROFILE_SECTION_VISIBILITY,
  type ProfileAccount,
  type ProfileAccountUpdateInput,
  type ProfileDevice,
  type ProfileNotification,
  type ProfileNotificationPreferences,
  type ProfileNotifications,
  type ProfilePasswordChangeInput,
  type ProfilePreferencesUpdateInput,
  type ProfilePrivacyDeletionRequestInput,
  type ProfilePrivacyExportRequestInput,
  type ProfilePrivacy,
  type ProfilePrivacyPreferences,
  type ProfilePrivacyRequest,
  type ProfilePrivacyRequestStatus,
  type ProfilePrivacyRequestType,
  type ProfilePrivacyUpdateInput,
  type ProfilePrivacyWorkflowResponse,
  type ProfileRole,
  type ProfileSection,
  type ProfileSectionId,
  type ProfileSecurity,
  type ProfileSecurityEvent,
  type ProfileSession,
  type ProfileSnapshot,
  type ProfileSnapshotResponse,
  type ProfileTrustDeviceInput,
  type ProfileRecoveryCodeRotationResponse,
} from "@/types/profile";

import type {
  ProfileAccountUpdateInput,
  ProfilePasswordChangeInput,
  ProfilePreferencesUpdateInput,
  ProfilePrivacyDeletionRequestInput,
  ProfilePrivacyExportRequestInput,
  ProfilePrivacyUpdateInput,
  ProfilePrivacyWorkflowResponse,
  ProfileSnapshotResponse,
  ProfileTrustDeviceInput,
  ProfileRecoveryCodeRotationResponse,
} from "@/types/profile";

function readProfile<T>(response: Response, fallbackMessage: string) {
  return parseBackendJsonResponse<T>(response, fallbackMessage);
}

export async function getProfile() {
  const response = await backendJsonFetch("/profile");
  return readProfile<ProfileSnapshotResponse>(response, "Unable to load profile.");
}

export async function updateProfileAccount(input: ProfileAccountUpdateInput) {
  const response = await backendJsonFetch("/profile/account", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to update account.");
}

export async function updateProfileNotifications(input: ProfilePreferencesUpdateInput) {
  const response = await backendJsonFetch("/profile/notifications", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to update notification preferences.");
}

export async function updateProfilePrivacy(input: ProfilePrivacyUpdateInput) {
  const response = await backendJsonFetch("/profile/privacy", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to update privacy preferences.");
}

export async function requestProfileDataExport(input: ProfilePrivacyExportRequestInput = {}) {
  const response = await backendJsonFetch("/profile/privacy/export", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readProfile<ProfilePrivacyWorkflowResponse>(response, "Unable to request a profile export.");
}

export async function requestProfileDeletion(input: ProfilePrivacyDeletionRequestInput = {}) {
  const response = await backendJsonFetch("/profile/privacy/deletion-request", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readProfile<ProfilePrivacyWorkflowResponse>(response, "Unable to request profile deletion.");
}

export async function changeProfilePassword(input: ProfilePasswordChangeInput) {
  const response = await backendJsonFetch("/profile/security/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to change password.");
}

export async function enableProfileMfa() {
  const response = await backendJsonFetch("/profile/security/mfa/enable", {
    method: "POST",
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to enable MFA.");
}

export async function disableProfileMfa() {
  const response = await backendJsonFetch("/profile/security/mfa/disable", {
    method: "POST",
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to disable MFA.");
}

export async function revokeProfileSession(sessionId: string) {
  const response = await backendJsonFetch(`/profile/security/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to revoke profile session.");
}

export async function revokeAllProfileSessions() {
  const response = await backendJsonFetch("/profile/security/sessions/revoke-all", {
    method: "POST",
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to revoke all profile sessions.");
}

export async function rotateProfileRecoveryCodes() {
  const response = await backendJsonFetch("/profile/security/recovery-codes/rotate", {
    method: "POST",
  });
  return readProfile<ProfileRecoveryCodeRotationResponse>(response, "Unable to rotate recovery codes.");
}

export async function trustProfileDevice(sessionId: string, input: ProfileTrustDeviceInput) {
  const response = await backendJsonFetch(`/profile/security/trusted-devices/${encodeURIComponent(sessionId)}/trust`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to trust the device.");
}

export async function revokeProfileTrustedDevice(sessionId: string) {
  const response = await backendJsonFetch(`/profile/security/trusted-devices/${encodeURIComponent(sessionId)}/trust`, {
    method: "DELETE",
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to revoke trusted device.");
}

export async function acknowledgeProfileSecurityAlert(eventId: string) {
  const response = await backendJsonFetch(`/profile/security/alerts/${encodeURIComponent(eventId)}/acknowledge`, {
    method: "POST",
  });
  return readProfile<ProfileSnapshotResponse>(response, "Unable to acknowledge security alert.");
}
