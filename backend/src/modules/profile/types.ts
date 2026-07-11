import type { UserRole, PublicUser } from "../auth/types.js";

export type ProfileSectionId = "account" | "security" | "notifications" | "privacy";

export type ProfilePrivacyRequestType = "DATA_EXPORT" | "ACCOUNT_DELETION";

export type ProfilePrivacyRequestStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";

export type ProfileRole = Extract<UserRole, "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN">;

export const PROFILE_SECTION_IDS = ["account", "security", "notifications", "privacy"] as const;

export const PROFILE_SECTION_VISIBILITY: Record<ProfileRole, ProfileSectionId[]> = {
  CUSTOMER: ["account", "security", "notifications", "privacy"],
  NOMINEE: ["account", "security", "notifications"],
  VERIFICATION_OFFICER: ["account", "security", "notifications"],
  ADMIN: ["account", "security", "notifications", "privacy"],
  SUPER_ADMIN: ["account", "security", "notifications", "privacy"],
};

export const PROFILE_AUDIT_ACTIONS = {
  VIEWED: "PROFILE_VIEWED",
  ACCOUNT_UPDATED: "PROFILE_ACCOUNT_UPDATED",
  PASSWORD_CHANGED: "PROFILE_PASSWORD_CHANGED",
  PASSWORD_CHANGE_FAILED: "PROFILE_PASSWORD_CHANGE_FAILED",
  MFA_ENABLED: "PROFILE_MFA_ENABLED",
  MFA_DISABLED: "PROFILE_MFA_DISABLED",
  NOTIFICATIONS_UPDATED: "PROFILE_NOTIFICATION_PREFERENCES_UPDATED",
  PRIVACY_UPDATED: "PROFILE_PRIVACY_PREFERENCES_UPDATED",
  SESSION_REVOKED: "PROFILE_SESSION_REVOKED",
  SESSIONS_REVOKED: "PROFILE_SESSIONS_REVOKED",
  RECOVERY_CODES_ROTATED: "PROFILE_RECOVERY_CODES_ROTATED",
  TRUSTED_DEVICE_GRANTED: "PROFILE_TRUSTED_DEVICE_GRANTED",
  TRUSTED_DEVICE_REVOKED: "PROFILE_TRUSTED_DEVICE_REVOKED",
  SECURITY_ALERT_ACKNOWLEDGED: "PROFILE_SECURITY_ALERT_ACKNOWLEDGED",
  PRIVACY_EXPORT_REQUESTED: "PROFILE_PRIVACY_EXPORT_REQUESTED",
  PRIVACY_EXPORT_COMPLETED: "PROFILE_PRIVACY_EXPORT_COMPLETED",
  PRIVACY_DELETION_REQUESTED: "PROFILE_PRIVACY_DELETION_REQUESTED",
  PRIVACY_DELETION_APPROVED: "PROFILE_PRIVACY_DELETION_APPROVED",
  PRIVACY_DELETION_REJECTED: "PROFILE_PRIVACY_DELETION_REJECTED",
} as const;

export type ProfilePreferencesRecord = {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  workflowEnabled: boolean;
  securityEnabled: boolean;
  releaseEnabled: boolean;
  complianceEnabled: boolean;
  shareContactWithNominees: boolean;
  shareActivityWithNominees: boolean;
  allowDataExports: boolean;
  allowTrustedDeviceTracking: boolean;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileAccountSummary = {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: PublicUser["role"];
  status: PublicUser["status"];
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  mfaEnabled: boolean;
  initials: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileSecuritySession = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: ProfileRole;
  ipAddress: string | null;
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  isActive: boolean;
  trustedAt: string | null;
  trustRevokedAt: string | null;
  trustLabel: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
};

export type ProfileDeviceHistoryItem = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: ProfileRole;
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  ipAddress: string | null;
  firstSeenAt: string;
  lastLoginAt: string;
  activeSessionCount: number;
  totalSessionCount: number;
  isActive: boolean;
};

export type ProfileSecuritySummary = {
  mfaEnabled: boolean;
  activeSessionCount: number;
  totalSessionCount: number;
  recentSessions: ProfileSecuritySession[];
  sessionHistory: ProfileSecuritySession[];
  deviceHistory: ProfileDeviceHistoryItem[];
  loginHistory: Array<{
    id: string;
    eventType: string;
    eventDescription: string | null;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    isResolved: boolean;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
  }>;
  recentSecurityEvents: Array<{
    id: string;
    eventType: string;
    eventDescription: string | null;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    isResolved: boolean;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
  }>;
  trustedDeviceTrackingEnabled: boolean;
  passwordLastChangedAt: string | null;
  recoveryCodes: ProfileRecoveryCodeSummary;
  trustedDevices: ProfileTrustedDevice[];
  suspiciousLogins: ProfileSecurityAlert[];
  recentAlerts: ProfileSecurityAlert[];
};

export type ProfileRecoveryCodeSummary = {
  remainingCount: number;
  lastGeneratedAt: string | null;
  expiresAt: string | null;
  rotationRecommended: boolean;
};

export type ProfileTrustedDevice = {
  id: string;
  sessionId: string;
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  ipAddress: string | null;
  trustedAt: string;
  trustLabel: string | null;
  lastSeenAt: string;
  isTrusted: boolean;
};

export type ProfileSecurityAlert = {
  id: string;
  eventType: string;
  eventDescription: string | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  isResolved: boolean;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
};

export type ProfileHardeningSummary = {
  recoveryCodes: ProfileRecoveryCodeSummary;
  trustedDevices: ProfileTrustedDevice[];
  suspiciousLogins: ProfileSecurityAlert[];
  recentAlerts: ProfileSecurityAlert[];
};

export type ProfileNotificationSummary = {
  unreadCount: number;
  recentNotifications: Array<{
    id: string;
    title: string;
    message: string;
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
    status: "PENDING" | "SENT" | "FAILED";
    readAt: string | null;
    sentAt: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  lastReviewedAt: string | null;
  preferences: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    workflowEnabled: boolean;
    securityEnabled: boolean;
    releaseEnabled: boolean;
    complianceEnabled: boolean;
  };
};

export type ProfilePrivacySummary = {
  preferences: {
    shareContactWithNominees: boolean;
    shareActivityWithNominees: boolean;
    allowDataExports: boolean;
    allowTrustedDeviceTracking: boolean;
  };
  requests: ProfilePrivacyRequest[];
  lastReviewedAt: string | null;
  retentionNote: string;
};

export type ProfilePrivacyRequest = {
  id: string;
  requestType: ProfilePrivacyRequestType;
  status: ProfilePrivacyRequestStatus;
  reason: string | null;
  exportFormat: string | null;
  exportPayload: Record<string, unknown> | null;
  reviewNotes: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  completedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByRole: ProfileRole | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileSectionDefinition = {
  id: ProfileSectionId;
  title: string;
  summary: string;
  visible: boolean;
  reason: string;
};

export type ProfileSnapshot = {
  role: ProfileRole;
  sections: ProfileSectionDefinition[];
  account: ProfileAccountSummary;
  security: ProfileSecuritySummary;
  hardening: ProfileHardeningSummary;
  notifications: ProfileNotificationSummary;
  privacy: ProfilePrivacySummary;
  effectivePermissions: string[];
};

export type ProfileAccountUpdateInput = {
  fullName: string;
  mobile: string | null;
};

export type ProfilePasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type ProfilePreferencesUpdateInput = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  workflowEnabled: boolean;
  securityEnabled: boolean;
  releaseEnabled: boolean;
  complianceEnabled: boolean;
};

export type ProfilePrivacyUpdateInput = {
  shareContactWithNominees: boolean;
  shareActivityWithNominees: boolean;
  allowDataExports: boolean;
  allowTrustedDeviceTracking: boolean;
};

export type ProfilePrivacyExportRequestInput = {
  reason?: string | null;
};

export type ProfilePrivacyDeletionRequestInput = {
  reason?: string | null;
};

export type ProfilePrivacyWorkflowResponse = {
  profile: ProfileSnapshot;
  request: ProfilePrivacyRequest;
};

export type ProfileTrustDeviceInput = {
  label: string | null;
};

export type ProfileRecoveryCodeRotationResponse = {
  profile: ProfileSnapshot;
  generatedRecoveryCodes: string[];
};
