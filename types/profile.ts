export type ProfileRole = "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";

export type ProfileSectionId = "account" | "security" | "notifications" | "privacy";

export type ProfilePrivacyRequestType = "DATA_EXPORT" | "ACCOUNT_DELETION";

export type ProfilePrivacyRequestStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";

export const PROFILE_SECTION_IDS = ["account", "security", "notifications", "privacy"] as const;

export const PROFILE_SECTION_VISIBILITY: Record<ProfileRole, ProfileSectionId[]> = {
  CUSTOMER: ["account", "security", "notifications", "privacy"],
  NOMINEE: ["account", "security", "notifications"],
  VERIFICATION_OFFICER: ["account", "security", "notifications"],
  ADMIN: ["account", "security", "notifications", "privacy"],
  SUPER_ADMIN: ["account", "security", "notifications", "privacy"],
};

export type ProfileSection = {
  id: ProfileSectionId;
  title: string;
  summary: string;
  visible: boolean;
  reason: string;
};

export type ProfileAccount = {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: ProfileRole;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DECEASED";
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  mfaEnabled: boolean;
  initials: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileSecurityEvent = {
  id: string;
  eventType: string;
  eventDescription: string | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  isResolved: boolean;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
};

export type ProfileSession = {
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

export type ProfileDevice = {
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

export type ProfileNotification = {
  id: string;
  title: string;
  message: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
  status: "PENDING" | "SENT" | "FAILED";
  readAt: string | null;
  sentAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ProfileNotificationPreferences = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  workflowEnabled: boolean;
  securityEnabled: boolean;
  releaseEnabled: boolean;
  complianceEnabled: boolean;
};

export type ProfilePrivacyPreferences = {
  shareContactWithNominees: boolean;
  shareActivityWithNominees: boolean;
  allowDataExports: boolean;
  allowTrustedDeviceTracking: boolean;
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

export type ProfileSecurity = {
  mfaEnabled: boolean;
  activeSessionCount: number;
  recentSessions: ProfileSession[];
  sessionHistory: ProfileSession[];
  deviceHistory: ProfileDevice[];
  loginHistory: ProfileSecurityEvent[];
  recentSecurityEvents: ProfileSecurityEvent[];
  trustedDeviceTrackingEnabled: boolean;
  totalSessionCount: number;
  recoveryCodes: ProfileRecoveryCodeSummary;
  trustedDevices: ProfileTrustedDevice[];
  suspiciousLogins: ProfileSecurityAlert[];
  recentAlerts: ProfileSecurityAlert[];
  passwordLastChangedAt: string | null;
};

export type ProfileNotifications = {
  unreadCount: number;
  recentNotifications: ProfileNotification[];
  lastReviewedAt: string | null;
  preferences: ProfileNotificationPreferences;
};

export type ProfilePrivacy = {
  preferences: ProfilePrivacyPreferences;
  requests: ProfilePrivacyRequest[];
  lastReviewedAt: string | null;
  retentionNote: string;
};

export type ProfileSnapshot = {
  role: ProfileRole;
  sections: ProfileSection[];
  account: ProfileAccount;
  security: ProfileSecurity;
  hardening: {
    recoveryCodes: ProfileRecoveryCodeSummary;
    trustedDevices: ProfileTrustedDevice[];
    suspiciousLogins: ProfileSecurityAlert[];
    recentAlerts: ProfileSecurityAlert[];
  };
  notifications: ProfileNotifications;
  privacy: ProfilePrivacy;
  effectivePermissions: string[];
};

export type ProfileSnapshotResponse = {
  profile: ProfileSnapshot;
};

export type ProfileAccountUpdateInput = {
  fullName: string;
  mobile: string | null;
};

export type ProfilePreferencesUpdateInput = ProfileNotificationPreferences;

export type ProfilePrivacyUpdateInput = ProfilePrivacyPreferences;

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

export type ProfilePasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type ProfileTrustDeviceInput = {
  label: string | null;
};

export type ProfileRecoveryCodeRotationResponse = {
  profile: ProfileSnapshot;
  generatedRecoveryCodes: string[];
};
