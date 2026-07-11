export type UserRole = "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DECEASED";

export type AuthTokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "RECOVERY_CODE" | "MFA_CHALLENGE";

export type AuthRequestContext = {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
  browserInfo: string | null;
  deviceInfo: string | null;
  locationInfo: string | null;
};

export type UserRecord = {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  mfaEnabled: boolean;
  mustResetPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  userAgent: string | null;
  isActive: boolean;
  trustedAt: string | null;
  trustRevokedAt: string | null;
  trustLabel: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
};

export type AuthTokenRecord = {
  id: string;
  userId: string | null;
  tokenHash: string;
  purpose: AuthTokenPurpose;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  mfaEnabled: boolean;
  mustResetPassword: boolean;
  lastLoginAt: string | null;
};

export type SessionView = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  ipAddress: string | null;
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  userAgent: string | null;
  isActive: boolean;
  trustedAt: string | null;
  trustRevokedAt: string | null;
  trustLabel: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
};

export type AuthResponse = {
  statusCode: number;
  body: Record<string, unknown>;
  refreshToken?: string;
  clearRefreshCookie?: boolean;
};
