import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { hashPassword } from "../dist/lib/password.js";
import { createAuthService } from "../dist/modules/auth/auth.service.js";

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
  DATABASE_URL: "postgres://test",
  JWT_ACCESS_SECRET: "access-secret",
  JWT_REFRESH_SECRET: "refresh-secret",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  S3_BUCKET_NAME: "bucket",
  AWS_REGION: "ap-south-1",
  AWS_KMS_KEY_ID: "kms-key",
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: "no-reply@inherix.local",
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createMemoryAuthStore(user) {
  const tokens = [];
  const sessions = [];
  const auditLogs = [];
  const securityEvents = [];

  return {
    tokens,
    sessions,
    auditLogs,
    securityEvents,
    async findUserByEmail(email) {
      return user.email.toLowerCase() === email.toLowerCase() ? user : null;
    },
    async findUserById(id) {
      return id === user.id ? user : null;
    },
    async createAuthToken(input) {
      const record = {
        id: `token-${tokens.length + 1}`,
        userId: input.userId,
        tokenHash: input.tokenHash,
        purpose: input.purpose,
        expiresAt: input.expiresAt.toISOString(),
        usedAt: null,
        createdAt: new Date().toISOString(),
        metadata: input.metadata ?? {},
      };
      tokens.push(record);
      return record;
    },
    async findAuthToken(tokenHash, purpose) {
      return tokens.find((token) => token.tokenHash === tokenHash && token.purpose === purpose) ?? null;
    },
    async consumeAuthToken(id) {
      const token = tokens.find((item) => item.id === id);
      if (token) {
        token.usedAt = new Date().toISOString();
      }
    },
    async createSession(input) {
      const session = {
        id: input.id ?? `session-${sessions.length + 1}`,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        ipAddress: input.ipAddress,
        deviceInfo: input.deviceInfo,
        browserInfo: input.browserInfo,
        locationInfo: input.locationInfo,
        userAgent: input.userAgent,
        isActive: true,
        trustedAt: null,
        trustRevokedAt: null,
        trustLabel: null,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt.toISOString(),
        revokedAt: null,
        rotatedAt: null,
      };
      sessions.push(session);
      return session;
    },
    async findSessionById(id) {
      return sessions.find((session) => session.id === id) ?? null;
    },
    async listSessions() {
      return [];
    },
    async listActiveSessions() {
      return [];
    },
    async trustSessionById() {
      return null;
    },
    async revokeSession() {
      return null;
    },
    async revokeAllUserSessions() {
      return 0;
    },
    async rotateSession() {
      return null;
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push(entry);
    },
    async countSecurityEvents() {
      return 0;
    },
    async listPermissionsForUser() {
      return ["ADMIN_VIEW_TRIGGER_QUEUE", "ADMIN_MANAGE_USERS_LIMITED"];
    },
    async listPermissionsForRole() {
      return ["ADMIN_VIEW_TRIGGER_QUEUE", "ADMIN_MANAGE_USERS_LIMITED"];
    },
    async listRolePermissions() {
      return [];
    },
    async updateUser() {
      return user;
    },
    async touchLastLogin() {},
    async createUser() {
      return user;
    },
    async findPermissionByKey() {
      return null;
    },
    async listPermissions() {
      return [];
    },
    async replaceRolePermissions() {
      return [];
    },
    async findNomineeAssignment() {
      return null;
    },
    async revokeTrustedSessionById() {
      return null;
    },
    async listAuthTokensByPurpose() {
      return [];
    },
    async revokeAuthTokensByPurpose() {
      return 0;
    },
  };
}

test("privileged users must complete the MFA challenge before the session is issued", async () => {
  const passwordHash = await hashPassword("Inherix@123");
  const user = {
    id: "user-1",
    fullName: "Admin User",
    email: "admin@example.com",
    mobile: "9999999999",
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    isEmailVerified: true,
    isMobileVerified: true,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const store = createMemoryAuthStore(user);
  const sentCodes = [];
  const emailService = {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
    async sendMfaChallengeEmail(_to, _fullName, code) {
      sentCodes.push(code);
    },
    async sendNomineeInvitationEmail() {},
  };

  const auth = createAuthService(testEnv, createLogger("silent"), store, emailService);

  const loginResponse = await auth.login(
    { email: user.email, password: "Inherix@123" },
    {
      requestId: "req-1",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(loginResponse.statusCode, 202);
  assert.equal(sentCodes.length, 1);
  assert.equal(loginResponse.body.data.mfaRequired, true);
  assert.equal(loginResponse.body.data.mfaCodePreview, sentCodes[0]);

  const verifyResponse = await auth.verifyMfaChallenge(
    { email: user.email, code: sentCodes[0] },
    {
      requestId: "req-2",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(verifyResponse.statusCode, 200);
  assert.ok(typeof verifyResponse.refreshToken === "string");
  assert.equal(store.sessions.length, 1);
  assert.equal(store.auditLogs.at(-1)?.action, "LOGIN_SUCCESS");
  assert.equal(store.securityEvents.some((event) => event.eventType === "MFA_CHALLENGE_VERIFIED"), true);
});

test("verification officers must verify email before privileged sign-in and then receive MFA", async () => {
  const passwordHash = await hashPassword("Officer@123");
  const user = {
    id: "user-2",
    fullName: "Verification Officer",
    email: "officer@example.com",
    mobile: "9999999998",
    passwordHash,
    role: "VERIFICATION_OFFICER",
    status: "ACTIVE",
    isEmailVerified: false,
    isMobileVerified: true,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const store = createMemoryAuthStore(user);
  const sentCodes = [];
  const emailService = {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
    async sendMfaChallengeEmail(_to, _fullName, code) {
      sentCodes.push(code);
    },
    async sendNomineeInvitationEmail() {},
  };

  const auth = createAuthService(testEnv, createLogger("silent"), store, emailService);

  const blockedLogin = await auth.login(
    { email: user.email, password: "Officer@123" },
    {
      requestId: "req-3",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(blockedLogin.statusCode, 403);
  assert.equal(blockedLogin.body.errorCode, "EMAIL_VERIFICATION_REQUIRED");

  user.isEmailVerified = true;

  const loginResponse = await auth.login(
    { email: user.email, password: "Officer@123" },
    {
      requestId: "req-4",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(loginResponse.statusCode, 202);
  assert.equal(loginResponse.body.data.mfaRequired, true);
  assert.equal(sentCodes.length, 1);
  assert.equal(sentCodes[0].length, 6);
});

test("temporary privileged credentials require an immediate password reset", async () => {
  const passwordHash = await hashPassword("Temp@12345");
  const user = {
    id: "user-3",
    fullName: "Officer Temp",
    email: "temp-officer@example.com",
    mobile: "9999999997",
    passwordHash,
    role: "VERIFICATION_OFFICER",
    status: "ACTIVE",
    isEmailVerified: true,
    isMobileVerified: true,
    mfaEnabled: true,
    mustResetPassword: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const store = createMemoryAuthStore(user);
  const emailService = {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
    async sendMfaChallengeEmail() {},
    async sendNomineeInvitationEmail() {},
  };

  const auth = createAuthService(testEnv, createLogger("silent"), store, emailService);

  const loginResponse = await auth.login(
    { email: user.email, password: "Temp@12345" },
    {
      requestId: "req-5",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.body.data.passwordResetRequired, true);
  assert.equal(loginResponse.body.data.nextPath, "/onboarding/force-reset-password");
  assert.equal(typeof loginResponse.refreshToken, "string");
});

test("invited nominee registration keeps the account on the nominee path", async () => {
  const createdUsers = [];
  const store = {
    tokens: [],
    sessions: [],
    auditLogs: [],
    securityEvents: [],
    async findUserByEmail(email) {
      return createdUsers.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async findUserById(id) {
      return createdUsers.find((user) => user.id === id) ?? null;
    },
    async createAuthToken(input) {
      const token = {
        id: `token-${this.tokens.length + 1}`,
        userId: input.userId,
        tokenHash: input.tokenHash,
        purpose: input.purpose,
        expiresAt: input.expiresAt.toISOString(),
        usedAt: null,
        createdAt: new Date().toISOString(),
        metadata: input.metadata ?? {},
      };
      this.tokens.push(token);
      return token;
    },
    async findAuthToken(tokenHash, purpose) {
      return this.tokens.find((token) => token.tokenHash === tokenHash && token.purpose === purpose) ?? null;
    },
    async consumeAuthToken(id) {
      const token = this.tokens.find((item) => item.id === id);
      if (token) {
        token.usedAt = new Date().toISOString();
      }
    },
    async createSession(input) {
      const session = {
        id: input.id ?? `session-${this.sessions.length + 1}`,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        ipAddress: input.ipAddress,
        deviceInfo: input.deviceInfo,
        browserInfo: input.browserInfo,
        locationInfo: input.locationInfo,
        userAgent: input.userAgent,
        isActive: true,
        trustedAt: null,
        trustRevokedAt: null,
        trustLabel: null,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt.toISOString(),
        revokedAt: null,
        rotatedAt: null,
      };
      this.sessions.push(session);
      return session;
    },
    async findSessionById(id) {
      return this.sessions.find((session) => session.id === id) ?? null;
    },
    async listSessions() {
      return [];
    },
    async listActiveSessions() {
      return [];
    },
    async trustSessionById() {
      return null;
    },
    async revokeSession() {
      return null;
    },
    async revokeAllUserSessions() {
      return 0;
    },
    async rotateSession() {
      return null;
    },
    async insertAuditLog(entry) {
      this.auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      this.securityEvents.push(entry);
    },
    async countSecurityEvents() {
      return 0;
    },
    async listPermissionsForUser() {
      return ["NOMINEE_ACCEPT_INVITATION", "NOMINEE_VIEW_RELEASED_DOCUMENT"];
    },
    async listPermissionsForRole(role) {
      if (role === "NOMINEE") {
        return ["NOMINEE_ACCEPT_INVITATION", "NOMINEE_VIEW_RELEASED_DOCUMENT"];
      }

      return [];
    },
    async listRolePermissions() {
      return [];
    },
    async updateUser(userId, values) {
      const user = createdUsers.find((item) => item.id === userId);
      if (!user) {
        return null;
      }

      Object.assign(user, {
        fullName: values.fullName ?? user.fullName,
        mobile: values.mobile ?? user.mobile,
        passwordHash: values.passwordHash ?? user.passwordHash,
        role: values.role ?? user.role,
        status: values.status ?? user.status,
        isEmailVerified: values.isEmailVerified ?? user.isEmailVerified,
        isMobileVerified: values.isMobileVerified ?? user.isMobileVerified,
        mustResetPassword: values.mustResetPassword ?? user.mustResetPassword,
        updatedAt: new Date().toISOString(),
      });

      return user;
    },
    async touchLastLogin() {},
    async createUser(input) {
      const user = {
        id: `user-${createdUsers.length + 1}`,
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        passwordHash: input.passwordHash,
        role: input.role ?? "CUSTOMER",
        status: input.status ?? "ACTIVE",
        isEmailVerified: input.isEmailVerified ?? false,
        isMobileVerified: input.isMobileVerified ?? false,
        mfaEnabled: input.mfaEnabled ?? false,
        mustResetPassword: input.mustResetPassword ?? false,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      createdUsers.push(user);
      return user;
    },
    async findPermissionByKey() {
      return null;
    },
    async listPermissions() {
      return [];
    },
    async replaceRolePermissions() {
      return [];
    },
    async findNomineeAssignment() {
      return null;
    },
    async revokeTrustedSessionById() {
      return null;
    },
    async listAuthTokensByPurpose() {
      return [];
    },
    async revokeAuthTokensByPurpose() {
      return 0;
    },
  };

  const emailService = {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
    async sendMfaChallengeEmail() {},
    async sendNomineeInvitationEmail() {},
  };

  const auth = createAuthService(testEnv, createLogger("silent"), store, emailService);

  const registerResponse = await auth.register(
    {
      fullName: "Sixer Nominee",
      email: "sixer3080@gmail.com",
      mobile: "9999999996",
      password: "Abhi1234#",
      invitationToken: "invite-token-123",
    },
    {
      requestId: "req-6",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(registerResponse.statusCode, 201);
  assert.equal(registerResponse.body.data.role, "NOMINEE");
  assert.equal(createdUsers[0].role, "NOMINEE");

  createdUsers[0].isEmailVerified = true;

  const loginResponse = await auth.login(
    { email: "sixer3080@gmail.com", password: "Abhi1234#" },
    {
      requestId: "req-7",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.body.data.user.role, "NOMINEE");
  assert.equal(loginResponse.body.data.nextPath, "/dashboard/released-documents");
});

test("invite-aware login keeps nominees on the invitation handoff path", async () => {
  const passwordHash = await hashPassword("Abhi1234#");
  const user = {
    id: "user-4",
    fullName: "Sixer Nominee",
    email: "sixer3080@gmail.com",
    mobile: "9999999996",
    passwordHash,
    role: "NOMINEE",
    status: "ACTIVE",
    isEmailVerified: true,
    isMobileVerified: true,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const store = createMemoryAuthStore(user);
  const emailService = {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
    async sendMfaChallengeEmail() {},
    async sendNomineeInvitationEmail() {},
  };

  const auth = createAuthService(testEnv, createLogger("silent"), store, emailService);

  const loginResponse = await auth.login(
    {
      email: user.email,
      password: "Abhi1234#",
      invitationToken: "invite-token-123",
    },
    {
      requestId: "req-8",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.body.data.user.role, "NOMINEE");
  assert.equal(
    loginResponse.body.data.nextPath,
    "/onboarding/accept-invitation?token=invite-token-123"
  );
});

test("login rate limiting stays scoped to the matched account when multiple users share an IP", async () => {
  const passwordHash = await hashPassword("SharedIp@123");
  const user = {
    id: "user-5",
    fullName: "Shared IP Customer",
    email: "shared-ip@example.com",
    mobile: "9999999995",
    passwordHash,
    role: "CUSTOMER",
    status: "ACTIVE",
    isEmailVerified: true,
    isMobileVerified: true,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const store = createMemoryAuthStore(user);
  const rateLimitCalls = [];
  store.countSecurityEvents = async (...args) => {
    rateLimitCalls.push(args);
    const userId = args[3];
    return userId === user.id ? 0 : 10;
  };

  const emailService = {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
    async sendMfaChallengeEmail() {},
    async sendNomineeInvitationEmail() {},
  };

  const auth = createAuthService(testEnv, createLogger("silent"), store, emailService);

  const loginResponse = await auth.login(
    { email: user.email, password: "SharedIp@123" },
    {
      requestId: "req-9",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      browserInfo: "browser",
      deviceInfo: "device",
      locationInfo: "location",
    }
  );

  assert.equal(loginResponse.statusCode, 200);
  assert.equal(rateLimitCalls.length, 1);
  assert.equal(rateLimitCalls[0][3], user.id);
});
