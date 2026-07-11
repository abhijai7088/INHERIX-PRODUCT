import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";
import { createProfileService } from "../dist/modules/profile/profile.service.js";
import { createRbacService } from "../dist/modules/rbac/rbac.service.js";
import { hashPassword } from "../dist/lib/password.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: 0,
  API_PREFIX: "/api/v1",
  API_BASE_URL: "http://127.0.0.1:0/api/v1",
  LOG_LEVEL: "silent",
  FRONTEND_ORIGIN: "http://localhost:3000",
  SWAGGER_ENABLED: true,
  TRUST_PROXY: false,
  REQUEST_BODY_LIMIT: "1mb",
  DATABASE_URL: undefined,
  JWT_ACCESS_SECRET: undefined,
  JWT_REFRESH_SECRET: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  S3_BUCKET_NAME: undefined,
  AWS_REGION: undefined,
  AWS_KMS_KEY_ID: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

async function withServer(dependencies, run) {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger, dependencies);

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function createMemoryProfileDependencies() {
  const initialPasswordHash = await hashPassword("Password@123");
  const user = {
    id: "customer-1",
    fullName: "Alex Johnson",
    email: "alex@example.com",
    mobile: "9999999999",
    passwordHash: initialPasswordHash,
    role: "CUSTOMER",
    status: "ACTIVE",
    isEmailVerified: true,
    isMobileVerified: true,
    mfaEnabled: false,
    lastLoginAt: "2026-07-01T12:00:00.000Z",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-20T12:00:00.000Z",
  };

  const nominee = {
    id: "nominee-1",
    fullName: "Nominee User",
    email: "nominee@example.com",
    mobile: "8888888888",
    passwordHash: initialPasswordHash,
    role: "NOMINEE",
    status: "ACTIVE",
    isEmailVerified: true,
    isMobileVerified: true,
    mfaEnabled: false,
    lastLoginAt: "2026-07-01T12:00:00.000Z",
    createdAt: "2026-06-02T12:00:00.000Z",
    updatedAt: "2026-06-20T12:00:00.000Z",
  };

  const users = new Map([
    [user.id, user],
    [nominee.id, nominee],
  ]);

  const sessions = [
    {
      id: "session-1",
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      refreshTokenHash: "refresh-1",
      ipAddress: "10.0.0.1",
      deviceInfo: "MacBook Pro",
      browserInfo: "Chrome",
      locationInfo: "Delhi, IN",
      userAgent: "Chrome",
      isActive: true,
      createdAt: "2026-07-01T11:55:00.000Z",
      expiresAt: "2026-07-15T11:55:00.000Z",
      revokedAt: null,
      rotatedAt: null,
      trustedAt: null,
      trustRevokedAt: null,
      trustLabel: null,
    },
    {
      id: "session-2",
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      refreshTokenHash: "refresh-2",
      ipAddress: "10.0.0.2",
      deviceInfo: "Windows Desktop",
      browserInfo: "Edge",
      locationInfo: "Bengaluru, IN",
      userAgent: "Edge",
      isActive: true,
      createdAt: "2026-07-01T10:55:00.000Z",
      expiresAt: "2026-07-15T10:55:00.000Z",
      revokedAt: null,
      rotatedAt: null,
      trustedAt: "2026-07-01T10:55:30.000Z",
      trustRevokedAt: null,
      trustLabel: "Windows desktop",
    },
    {
      id: "session-3",
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      refreshTokenHash: "refresh-3",
      ipAddress: "10.0.0.3",
      deviceInfo: "iPhone 15",
      browserInfo: "Safari",
      locationInfo: "Mumbai, IN",
      userAgent: "Safari",
      isActive: false,
      createdAt: "2026-06-30T10:55:00.000Z",
      expiresAt: "2026-07-14T10:55:00.000Z",
      revokedAt: "2026-07-01T09:00:00.000Z",
      rotatedAt: null,
      trustedAt: null,
      trustRevokedAt: null,
      trustLabel: null,
    },
  ];

  const authTokens = [
    {
      id: "token-1",
      userId: user.id,
      tokenHash: "recovery-1",
      purpose: "RECOVERY_CODE",
      expiresAt: "2026-12-31T00:00:00.000Z",
      usedAt: null,
      createdAt: "2026-07-01T10:00:00.000Z",
      metadata: { source: "profile" },
    },
  ];

  const preferences = {
    userId: user.id,
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    workflowEnabled: true,
    securityEnabled: true,
    releaseEnabled: true,
    complianceEnabled: false,
    shareContactWithNominees: false,
    shareActivityWithNominees: false,
    allowDataExports: true,
    allowTrustedDeviceTracking: true,
    lastReviewedAt: null,
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-20T12:00:00.000Z",
  };

  const auditLogs = [];
  const securityEvents = [];
  const privacyRequests = [];
  securityEvents.push({
    id: "sec-1",
    userId: user.id,
    eventType: "LOGIN_SUCCESS",
    eventDescription: "Successful login from a trusted device.",
    ipAddress: "10.0.0.1",
    deviceInfo: "MacBook Pro",
    riskLevel: "LOW",
    isResolved: true,
    createdAt: "2026-07-01T11:55:30.000Z",
    actorName: "Alex Johnson",
    actorEmail: "alex@example.com",
  });
  securityEvents.push({
    id: "sec-2",
    userId: user.id,
    eventType: "SUSPICIOUS_LOGIN_DETECTED",
    eventDescription: "New login detected from an untrusted device.",
    ipAddress: "10.0.0.9",
    deviceInfo: "Unknown Desktop",
    riskLevel: "HIGH",
    isResolved: false,
    createdAt: "2026-07-01T12:10:00.000Z",
    actorName: "System",
    actorEmail: null,
  });
  const notifications = [
    {
      id: "note-1",
      userId: user.id,
      title: "Security check",
      message: "Review your trusted devices.",
      channel: "IN_APP",
      status: "SENT",
      readAt: null,
      sentAt: "2026-07-01T11:00:00.000Z",
      metadata: { category: "security" },
      createdAt: "2026-07-01T11:00:00.000Z",
      actorName: "System",
      actorRole: "ADMIN",
    },
  ];

  const authStore = {
    async findUserById(id) {
      const current = users.get(id);
      return current ? { ...current } : null;
    },
    async updateUser(id, values) {
      const current = users.get(id);
      if (!current) return null;
      Object.assign(current, values);
      current.updatedAt = "2026-07-01T12:30:00.000Z";
      return { ...current };
    },
    async listActiveSessions(userId) {
      return sessions.filter((session) => session.userId === userId && session.isActive);
    },
    async listSessions(userId) {
      return sessions.filter((session) => session.userId === userId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async revokeSession(id) {
      const session = sessions.find((item) => item.id === id);
      if (!session) return null;
      session.isActive = false;
      session.revokedAt = "2026-07-01T12:31:00.000Z";
      return { ...session };
    },
    async revokeAllUserSessions(userId) {
      let revoked = 0;
      for (const session of sessions) {
        if (session.userId === userId && session.isActive) {
          session.isActive = false;
          session.revokedAt = "2026-07-01T12:31:00.000Z";
          revoked += 1;
        }
      }
      return revoked;
    },
    async trustSessionById(id, label) {
      const session = sessions.find((item) => item.id === id);
      if (!session) return null;
      session.trustedAt = "2026-07-01T12:32:00.000Z";
      session.trustRevokedAt = null;
      session.trustLabel = label ?? session.trustLabel ?? session.deviceInfo ?? "Trusted device";
      return { ...session };
    },
    async revokeTrustedSessionById(id) {
      const session = sessions.find((item) => item.id === id);
      if (!session) return null;
      session.trustRevokedAt = "2026-07-01T12:33:00.000Z";
      return { ...session };
    },
    async createAuthToken(entry) {
      const token = {
        id: `token-${authTokens.length + 1}`,
        userId: entry.userId,
        tokenHash: entry.tokenHash,
        purpose: entry.purpose,
        expiresAt: entry.expiresAt.toISOString(),
        usedAt: null,
        createdAt: "2026-07-01T12:30:00.000Z",
        metadata: entry.metadata ?? {},
      };
      authTokens.push(token);
      return { ...token };
    },
    async listAuthTokensByPurpose(userId, purpose) {
      return authTokens
        .filter((token) => token.userId === userId && token.purpose === purpose)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((token) => ({ ...token }));
    },
    async revokeAuthTokensByPurpose(userId, purpose) {
      let revoked = 0;
      for (const token of authTokens) {
        if (token.userId === userId && token.purpose === purpose && !token.usedAt) {
          token.usedAt = "2026-07-01T12:34:00.000Z";
          revoked += 1;
        }
      }
      return revoked;
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push({
        id: `sec-${securityEvents.length + 1}`,
        userId: entry.userId,
        eventType: entry.eventType,
        eventDescription: entry.eventDescription,
        ipAddress: entry.ipAddress,
        deviceInfo: entry.deviceInfo,
        riskLevel: entry.riskLevel,
        isResolved: false,
        createdAt: "2026-07-01T12:31:00.000Z",
        actorName: "System",
        actorEmail: null,
      });
    },
    async resolveSecurityEvent(id) {
      const event = securityEvents.find((item) => item.id === id);
      if (!event) return false;
      event.isResolved = true;
      return true;
    },
    async createNotification(entry) {
      notifications.push({
        id: `note-${notifications.length + 1}`,
        userId: entry.userId,
        title: entry.title,
        message: entry.message,
        channel: entry.channel ?? "IN_APP",
        status: entry.status ?? "SENT",
        readAt: null,
        sentAt: "2026-07-01T12:31:00.000Z",
        metadata: entry.metadata ?? {},
        createdAt: "2026-07-01T12:31:00.000Z",
        actorName: "System",
        actorRole: "ADMIN",
      });
    },
  };

  const observabilityStore = {
    async listNotifications({ userId }) {
      return notifications.filter((item) => item.userId === userId);
    },
    async listSecurityEvents({ userId }) {
      return securityEvents.filter((item) => item.userId === userId);
    },
    async countUnreadNotifications(userId) {
      return notifications.filter((item) => item.userId === userId && !item.readAt).length;
    },
    async countSessions(userId, activeOnly = false) {
      return sessions.filter((item) => item.userId === userId && (!activeOnly || item.isActive)).length;
    },
  };

  const profileStore = {
    async getPreferences() {
      return { ...preferences };
    },
    async updatePreferences(_, input) {
      Object.assign(preferences, input, { lastReviewedAt: "2026-07-01T12:30:00.000Z", updatedAt: "2026-07-01T12:30:00.000Z" });
      return { ...preferences };
    },
    async updatePrivacy(_, input) {
      Object.assign(preferences, input, { lastReviewedAt: "2026-07-01T12:30:00.000Z", updatedAt: "2026-07-01T12:30:00.000Z" });
      return { ...preferences };
    },
    async listPrivacyRequests(userId) {
      return privacyRequests
        .filter((item) => item.userId === userId)
        .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
    },
    async createPrivacyExportRequest(userId, input) {
      const record = {
        id: `privacy-${privacyRequests.length + 1}`,
        userId,
        requestType: "DATA_EXPORT",
        status: "COMPLETED",
        reason: input.reason ?? null,
        exportFormat: "JSON",
        exportPayload: input.exportPayload,
        reviewNotes: null,
        requestedAt: "2026-07-01T12:40:00.000Z",
        reviewedAt: null,
        completedAt: "2026-07-01T12:40:00.000Z",
        reviewedByUserId: null,
        reviewedByRole: null,
        createdAt: "2026-07-01T12:40:00.000Z",
        updatedAt: "2026-07-01T12:40:00.000Z",
      };
      privacyRequests.unshift(record);
      return { ...record };
    },
    async createPrivacyDeletionRequest(userId, input) {
      const record = {
        id: `privacy-${privacyRequests.length + 1}`,
        userId,
        requestType: "ACCOUNT_DELETION",
        status: "REQUESTED",
        reason: input.reason ?? null,
        exportFormat: null,
        exportPayload: null,
        reviewNotes: null,
        requestedAt: "2026-07-01T12:41:00.000Z",
        reviewedAt: null,
        completedAt: null,
        reviewedByUserId: null,
        reviewedByRole: null,
        createdAt: "2026-07-01T12:41:00.000Z",
        updatedAt: "2026-07-01T12:41:00.000Z",
      };
      privacyRequests.unshift(record);
      return { ...record };
    },
    async reviewPrivacyDeletionRequest() {
      return null;
    },
  };

  const authStoreWithPassword = {
    ...authStore,
    async listPermissionsForUser() {
      return ["USER_VIEW_OWN_AUDIT_LOG"];
    },
    async findUserById(id) {
      if (id === user.id) {
        return { ...user };
      }

      if (id === nominee.id) {
        return { ...nominee };
      }

      return null;
    },
  };

  return {
    principal: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      session: { id: "session-1" },
      accessToken: "token",
      authenticatedBy: "access",
    },
    nomineePrincipal: {
      user: {
        id: nominee.id,
        email: nominee.email,
        role: nominee.role,
        fullName: nominee.fullName,
      },
      session: { id: "session-2" },
      accessToken: "token-2",
      authenticatedBy: "access",
    },
    auditLogs,
    securityEvents,
    notifications,
    profileService: createProfileService(testEnv, createLogger("silent"), {
      authStore: {
        ...authStoreWithPassword,
        async updateUser(id, values) {
          if (typeof values.passwordHash === "string") {
            user.passwordHash = values.passwordHash;
          }
          if (typeof values.mfaEnabled === "boolean") {
            user.mfaEnabled = values.mfaEnabled;
          }
          return authStore.updateUser(id, values);
        },
      },
      observabilityStore,
      profileStore,
      rbacService: createRbacService({
        async listPermissionsForUser() {
          return ["USER_VIEW_OWN_AUDIT_LOG"];
        },
      }),
    }),
  };
}

test("profile surface exposes live snapshot and auditable mutations", async () => {
  const memory = await createMemoryProfileDependencies();

  await withServer(
    {
      profile: {
        resolveAuthSnapshot: async () => memory.principal,
        profileService: memory.profileService,
      },
    },
    async (baseUrl) => {
      const profileResponse = await fetch(`${baseUrl}/api/v1/profile`);
      const profileResponseText = await profileResponse.text();
      assert.equal(profileResponse.status, 200, profileResponseText);
      const profileJson = JSON.parse(profileResponseText);
      assert.equal(profileJson.success, true);
      assert.equal(profileJson.data.profile.account.fullName, "Alex Johnson");
      assert.equal(profileJson.data.profile.sections[0].id, "account");
      assert.equal(profileJson.data.profile.sections.find((section) => section.id === "privacy").visible, true);
      assert.equal(profileJson.data.profile.notifications.lastReviewedAt, null);
      assert.equal(profileJson.data.profile.security.sessionHistory.length, 3);
      assert.equal(profileJson.data.profile.security.deviceHistory.length, 3);
      assert.equal(profileJson.data.profile.security.loginHistory.length, 1);
      assert.equal(profileJson.data.profile.hardening.recoveryCodes.remainingCount, 1);
      assert.equal(profileJson.data.profile.hardening.trustedDevices.length, 1);
      assert.equal(profileJson.data.profile.hardening.suspiciousLogins.length, 1);
      assert.equal(profileJson.data.profile.privacy.requests.length, 0);

      const notificationResponse = await fetch(`${baseUrl}/api/v1/profile/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled: false,
          smsEnabled: true,
          inAppEnabled: false,
          workflowEnabled: false,
          securityEnabled: true,
          releaseEnabled: false,
          complianceEnabled: true,
        }),
      });
      assert.equal(notificationResponse.status, 200);
      const notificationJson = await notificationResponse.json();
      assert.equal(notificationJson.data.profile.notifications.preferences.emailEnabled, false);
      assert.equal(notificationJson.data.profile.notifications.preferences.smsEnabled, true);
      assert.equal(notificationJson.data.profile.notifications.lastReviewedAt, "2026-07-01T12:30:00.000Z");
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_NOTIFICATION_PREFERENCES_UPDATED");
      assert.equal(memory.notifications.at(-1).title, "Notification preferences updated");

      const trustResponse = await fetch(`${baseUrl}/api/v1/profile/security/trusted-devices/session-1/trust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Primary desktop" }),
      });
      assert.equal(trustResponse.status, 200);
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_TRUSTED_DEVICE_GRANTED");

      const revokeTrustResponse = await fetch(`${baseUrl}/api/v1/profile/security/trusted-devices/session-1/trust`, {
        method: "DELETE",
      });
      assert.equal(revokeTrustResponse.status, 200);
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_TRUSTED_DEVICE_REVOKED");

      const acknowledgeResponse = await fetch(`${baseUrl}/api/v1/profile/security/alerts/sec-2/acknowledge`, {
        method: "POST",
      });
      assert.equal(acknowledgeResponse.status, 200);
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_SECURITY_ALERT_ACKNOWLEDGED");
      assert.equal(memory.securityEvents.find((event) => event.id === "sec-2").isResolved, true);

      const accountResponse = await fetch(`${baseUrl}/api/v1/profile/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Alex J. Johnson", mobile: "8888888888" }),
      });
      assert.equal(accountResponse.status, 200);
      const accountJson = await accountResponse.json();
      assert.equal(accountJson.data.profile.account.fullName, "Alex J. Johnson");

      const mfaResponse = await fetch(`${baseUrl}/api/v1/profile/security/mfa/enable`, {
        method: "POST",
      });
      assert.equal(mfaResponse.status, 200);

      const rotateResponse = await fetch(`${baseUrl}/api/v1/profile/security/recovery-codes/rotate`, {
        method: "POST",
      });
      assert.equal(rotateResponse.status, 200);
      const rotateJson = await rotateResponse.json();
      assert.equal(rotateJson.data.generatedRecoveryCodes.length, 10);
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_RECOVERY_CODES_ROTATED");

      const revokeResponse = await fetch(`${baseUrl}/api/v1/profile/security/sessions/session-1`, {
        method: "DELETE",
      });
      assert.equal(revokeResponse.status, 200);
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_SESSION_REVOKED");

      const revokeAllResponse = await fetch(`${baseUrl}/api/v1/profile/security/sessions/revoke-all`, {
        method: "POST",
      });
      assert.equal(revokeAllResponse.status, 200);
      const revokeAllJson = await revokeAllResponse.json();
      assert.equal(revokeAllJson.data.profile.security.activeSessionCount, 0);
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_SESSIONS_REVOKED");

      const passwordHashBefore = memory.securityEvents.length;
      const passwordResponse = await fetch(`${baseUrl}/api/v1/profile/security/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: "Password@123", newPassword: "Password@456" }),
      });
      assert.equal(passwordResponse.status, 200);
      assert.ok(memory.auditLogs.some((entry) => entry.action === "PROFILE_PASSWORD_CHANGED"));
      assert.ok(memory.securityEvents.length > passwordHashBefore);

      const privacyResponse = await fetch(`${baseUrl}/api/v1/profile/privacy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareContactWithNominees: true,
          shareActivityWithNominees: false,
          allowDataExports: true,
          allowTrustedDeviceTracking: false,
        }),
      });
      assert.equal(privacyResponse.status, 200);
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_PRIVACY_PREFERENCES_UPDATED");
      assert.equal(memory.notifications.length >= 2, true);

      const exportResponse = await fetch(`${baseUrl}/api/v1/profile/privacy/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Annual record review" }),
      });
      assert.equal(exportResponse.status, 200);
      const exportJson = await exportResponse.json();
      assert.equal(exportJson.data.profile.privacy.requests[0].requestType, "DATA_EXPORT");
      assert.equal(exportJson.data.profile.privacy.requests[0].status, "COMPLETED");
      assert.equal(memory.auditLogs.at(-2).action, "PROFILE_PRIVACY_EXPORT_REQUESTED");
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_PRIVACY_EXPORT_COMPLETED");
      assert.equal(memory.notifications.at(-1).title, "Profile export ready");

      const deletionResponse = await fetch(`${baseUrl}/api/v1/profile/privacy/deletion-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Close my account" }),
      });
      assert.equal(deletionResponse.status, 201);
      const deletionJson = await deletionResponse.json();
      assert.equal(deletionJson.data.profile.privacy.requests[0].requestType, "ACCOUNT_DELETION");
      assert.equal(deletionJson.data.profile.privacy.requests[0].status, "REQUESTED");
      assert.equal(memory.auditLogs.at(-1).action, "PROFILE_PRIVACY_DELETION_REQUESTED");
      assert.equal(memory.notifications.at(-1).title, "Deletion request received");
    }
  );
});

test("profile privacy mutations are denied for nominee roles", async () => {
  const memory = await createMemoryProfileDependencies();

  await withServer(
    {
      profile: {
        resolveAuthSnapshot: async () => memory.nomineePrincipal,
        profileService: memory.profileService,
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/profile/privacy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareContactWithNominees: true,
          shareActivityWithNominees: true,
          allowDataExports: false,
          allowTrustedDeviceTracking: false,
        }),
      });

      assert.equal(response.status, 403);
      const payload = await response.json();
      assert.equal(payload.success, false);
      assert.equal(payload.errorCode, "FORBIDDEN");
    }
  );
});

test("profile privacy request workflows are denied for nominee roles", async () => {
  const memory = await createMemoryProfileDependencies();

  await withServer(
    {
      profile: {
        resolveAuthSnapshot: async () => memory.nomineePrincipal,
        profileService: memory.profileService,
      },
    },
    async (baseUrl) => {
      const exportResponse = await fetch(`${baseUrl}/api/v1/profile/privacy/export`, {
        method: "POST",
      });
      assert.equal(exportResponse.status, 403);

      const deletionResponse = await fetch(`${baseUrl}/api/v1/profile/privacy/deletion-request`, {
        method: "POST",
      });
      assert.equal(deletionResponse.status, 403);
    }
  );
});

test("profile notifications section remains visible for nominee roles", async () => {
  const memory = await createMemoryProfileDependencies();

  await withServer(
    {
      profile: {
        resolveAuthSnapshot: async () => memory.nomineePrincipal,
        profileService: memory.profileService,
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/profile`);
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.success, true);
      const sections = payload.data.profile.sections;
      assert.equal(sections.find((section) => section.id === "notifications")?.visible, true);
      assert.equal(sections.find((section) => section.id === "privacy")?.visible, false);
    }
  );
});

test("profile hardening mutations are denied for nominee roles", async () => {
  const memory = await createMemoryProfileDependencies();

  await withServer(
    {
      profile: {
        resolveAuthSnapshot: async () => memory.nomineePrincipal,
        profileService: memory.profileService,
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/profile/security/recovery-codes/rotate`, {
        method: "POST",
      });

      assert.equal(response.status, 403);
      const payload = await response.json();
      assert.equal(payload.success, false);
      assert.equal(payload.errorCode, "FORBIDDEN");
    }
  );
});
