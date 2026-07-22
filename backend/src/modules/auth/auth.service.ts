import type { IncomingMessage } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { parse as parseCookie } from "cookie";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { getPool } from "../../db/pool.js";
import { parseDuration, randomToken, sha256Hex } from "../../lib/crypto.js";
import { signJwt, verifyJwt } from "../../lib/jwt.js";
import { hashPassword, passwordPolicyViolations, verifyPassword } from "../../lib/password.js";
import { createPostgresAuthStore, type AuthStore } from "./auth.store.js";
import type {
  AuthRequestContext,
  AuthResponse,
  PublicUser,
  SessionRecord,
  UserRecord,
} from "./types.js";
import { createEmailService } from "../email/email.service.js";
import { createRbacService } from "../rbac/rbac.service.js";
import { resolveDashboardLandingPath } from "../rbac/permissions.js";

type RegisterInput = {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  invitationToken?: string | null;
};

type LoginInput = {
  email: string;
  password: string;
  invitationToken?: string | null;
};

type VerificationRequestInput = {
  email?: string;
};

type VerifyEmailInput = {
  token: string;
};

type ForgotPasswordInput = {
  email: string;
};

type ResetPasswordInput = {
  token: string;
  password: string;
};

type MfaVerifyInput = {
  email: string;
  code: string;
  invitationToken?: string | null;
};

const loginRateLimitWindowMs = 15 * 60 * 1000;
const forgotPasswordRateLimitWindowMs = 60 * 60 * 1000;
const refreshRateLimitWindowMs = 15 * 60 * 1000;
const mfaChallengeWindowMs = 10 * 60 * 1000;
const browserSessionCookieName = "inherix_browser_session";
const privilegedRoles = new Set<PublicUser["role"]>(["VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN", "CUSTOMER", "NOMINEE"]);

type TokenPayload = {
  sub?: string;
  sessionId?: string;
  tokenType?: "access" | "refresh";
};

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    status: user.status,
    isEmailVerified: user.isEmailVerified,
    isMobileVerified: user.isMobileVerified,
    mfaEnabled: user.mfaEnabled,
    mustResetPassword: user.mustResetPassword,
    lastLoginAt: user.lastLoginAt,
  };
}

function nextPathForUser(user: PublicUser) {
  if (!user.isEmailVerified) {
    return "/onboarding/verify-email";
  }

  if (user.mustResetPassword) {
    return "/onboarding/force-reset-password";
  }

  return resolveDashboardLandingPath(user.role);
}

function buildInvitationAcceptPath(token: string | null | undefined) {
  if (!token?.trim()) {
    return null;
  }

  return `/onboarding/accept-invitation?token=${encodeURIComponent(token.trim())}`;
}

function requireAuthSecrets(env: AppEnv) {
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required for auth flows.");
  }
}

function requiresPrivilegedMfa(user: UserRecord) {
  return privilegedRoles.has(user.role) || user.mfaEnabled;
}

function getAuthStore(env: AppEnv) {
  return createPostgresAuthStore(getPool(env));
}

function getRefreshTokenTtl(env: AppEnv) {
  return parseDuration(env.REFRESH_TOKEN_TTL);
}

function getAccessTokenTtl(env: AppEnv) {
  return parseDuration(env.ACCESS_TOKEN_TTL);
}

function createAccessToken(user: UserRecord, sessionId: string, env: AppEnv) {
  requireAuthSecrets(env);

  return signJwt(
    {
      sub: user.id,
      sessionId,
      tokenType: "access",
      email: user.email,
      role: user.role,
    },
    env.JWT_ACCESS_SECRET!,
    getAccessTokenTtl(env)
  );
}

function createRefreshToken(user: UserRecord, sessionId: string, env: AppEnv) {
  requireAuthSecrets(env);

  return signJwt(
    {
      sub: user.id,
      sessionId,
      tokenType: "refresh",
    },
    env.JWT_REFRESH_SECRET!,
    getRefreshTokenTtl(env)
  );
}

function buildSessionSignature(input: {
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
}) {
  return [input.deviceInfo ?? "", input.browserInfo ?? "", input.locationInfo ?? ""].join("|");
}

function getCookieToken(request: IncomingMessage, cookieName: string) {
  const rawCookie = request.headers.cookie;

  if (!rawCookie) {
    return null;
  }

  const parsed = parseCookie(rawCookie);
  return parsed[cookieName] ?? null;
}

function getBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return null;
  }

  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const [scheme, token] = value.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

function buildAuthEnvelope(message: string, data: Record<string, unknown>, requestId: string) {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

function buildErrorEnvelope(message: string, errorCode: string, requestId: string) {
  return {
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

function createAuditValue(value: Record<string, unknown> | null | undefined) {
  return value ?? null;
}

async function logAuthEvent(
  store: AuthStore,
  input: {
    userId: string | null;
    role: PublicUser["role"] | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    ipAddress: string | null;
    deviceInfo: string | null;
    eventType: string;
    eventDescription: string | null;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  }
) {
  await store.insertAuditLog({
    userId: input.userId,
    role: input.role,
    action: input.action,
    moduleName: "auth",
    entityType: input.entityType,
    entityId: input.entityId,
    oldValue: createAuditValue(input.oldValue),
    newValue: createAuditValue(input.newValue),
    ipAddress: input.ipAddress,
    deviceInfo: input.deviceInfo,
  });

  await store.insertSecurityEvent({
    userId: input.userId,
    eventType: input.eventType,
    eventDescription: input.eventDescription,
    ipAddress: input.ipAddress,
    deviceInfo: input.deviceInfo,
    riskLevel: input.riskLevel,
  });
}

async function enforceRateLimit(
  store: AuthStore,
  eventTypes: string[],
  ipAddress: string | null,
  since: Date,
  maxAttempts: number,
  errorMessage: string,
  requestId: string,
  userId: string | null = null
) {
  if (!ipAddress?.trim() && !userId) {
    return null;
  }

  const attempts = await store.countSecurityEvents(eventTypes, ipAddress, since, userId);

  if (attempts >= maxAttempts) {
    return {
      statusCode: 429,
      body: buildErrorEnvelope(errorMessage, "RATE_LIMITED", requestId),
    } satisfies AuthResponse;
  }

  return null;
}

async function issueSessionTokens(
  store: AuthStore,
  env: AppEnv,
  user: UserRecord,
  context: AuthRequestContext
) {
  const sessionId = randomUUID();
  const refreshToken = createRefreshToken(user, sessionId, env);
  const accessToken = createAccessToken(user, sessionId, env);
  const refreshTokenHash = sha256Hex(refreshToken);
  const expiresAt = new Date(Date.now() + getRefreshTokenTtl(env));

  await store.createSession({
    id: sessionId,
    userId: user.id,
    refreshTokenHash,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    browserInfo: context.browserInfo,
    locationInfo: context.locationInfo,
    userAgent: context.userAgent,
    expiresAt,
  });

  return {
    sessionId,
    refreshToken,
    accessToken,
  };
}

async function issueMfaChallenge(
  store: AuthStore,
  emailService: ReturnType<typeof createEmailService>,
  logger: Logger,
  user: UserRecord,
  context: AuthRequestContext
) {
  const code = randomInt(0, 1000000).toString().padStart(6, "0");
  await store.createAuthToken({
    userId: user.id,
    tokenHash: sha256Hex(code),
    purpose: "MFA_CHALLENGE",
    expiresAt: new Date(Date.now() + mfaChallengeWindowMs),
    metadata: {
      email: user.email,
      role: user.role,
      deviceInfo: context.deviceInfo,
      browserInfo: context.browserInfo,
    },
  });

  try {
    await emailService.sendMfaChallengeEmail(user.email, user.fullName, code, user.role);
  } catch (error) {
    logger.warn("MFA challenge delivery failed", {
      userId: user.id,
      email: user.email,
      role: user.role,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return code;
}

function validateAccessToken(token: string, env: AppEnv) {
  if (!env.JWT_ACCESS_SECRET) {
    return null;
  }

  const payload = verifyJwt<TokenPayload>(token, env.JWT_ACCESS_SECRET);

  if (!payload || payload.tokenType !== "access" || typeof payload.sub !== "string") {
    return null;
  }

  return payload;
}

function validateRefreshToken(token: string, env: AppEnv) {
  if (!env.JWT_REFRESH_SECRET) {
    return null;
  }

  const payload = verifyJwt<TokenPayload>(token, env.JWT_REFRESH_SECRET);

  if (!payload || payload.tokenType !== "refresh" || typeof payload.sub !== "string" || typeof payload.sessionId !== "string") {
    return null;
  }

  return payload;
}

async function resolveSessionFromRequest(
  request: IncomingMessage,
  context: AuthRequestContext,
  env: AppEnv,
  store: AuthStore
) {
  const bearerToken = getBearerToken(request);
  if (bearerToken) {
    const payload = validateAccessToken(bearerToken, env);
    if (!payload) {
      return null;
    }

    const user = await store.findUserById(payload.sub ?? "");
    if (!user) {
      return null;
    }

    const session = payload.sessionId ? await store.findSessionById(payload.sessionId) : null;
    if (payload.sessionId && (!session || !session.isActive)) {
      return null;
    }

    return {
      user,
      session,
      accessToken: bearerToken,
      authenticatedBy: "access" as const,
    };
  }

  const browserSessionCookie = getCookieToken(request, browserSessionCookieName);
  if (!browserSessionCookie) {
    return null;
  }

  const refreshToken = getCookieToken(request, env.AUTH_COOKIE_NAME);
  if (!refreshToken) {
    return null;
  }

  const payload = validateRefreshToken(refreshToken, env);
  if (!payload) {
    return null;
  }

  const tokenHash = sha256Hex(refreshToken);
  const session = await store.findSessionById(payload.sessionId ?? "");
  if (!session || !session.isActive || session.refreshTokenHash !== tokenHash) {
    if (session?.id) {
      await store.revokeSession(session.id);
    }
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await store.revokeSession(session.id);
    return null;
  }

  const user = await store.findUserById(payload.sub ?? "");
  if (!user) {
    return null;
  }

  const accessToken = createAccessToken(user, session.id, env);
  return {
    user,
    session,
    accessToken,
    authenticatedBy: "refresh" as const,
  };
}

export function createAuthService(env: AppEnv, logger: Logger, store = getAuthStore(env), emailService = createEmailService(env, logger)) {
  const rbac = createRbacService(store);

  async function buildAuthenticatedUserPayload(
    user: UserRecord,
    accessToken?: string,
    sessionId?: string,
    nextPathOverride?: string | null
  ) {
    const permissions = await rbac.listPermissionsForRole(user.role);

    return {
      user: toPublicUser(user),
      permissions,
      accessToken,
      sessionId: sessionId ?? null,
      nextPath: nextPathOverride ?? nextPathForUser(toPublicUser(user)),
    };
  }

  async function register(input: RegisterInput, context: AuthRequestContext): Promise<AuthResponse> {
    if (!input.fullName.trim() || !input.email.trim() || !input.mobile.trim() || !input.password.trim()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("All registration fields are required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const passwordViolations = passwordPolicyViolations(input.password);
    if (passwordViolations.length) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope(passwordViolations[0] ?? "Password policy failed.", "PASSWORD_POLICY_VIOLATION", context.requestId),
      };
    }

    const email = input.email.trim().toLowerCase();
    const existingUser = await store.findUserByEmail(email);
    const passwordHash = await hashPassword(input.password);

    let user: UserRecord;

    const invitedSignup = Boolean(input.invitationToken?.trim());

    if (existingUser && existingUser.isEmailVerified && !invitedSignup) {
      return {
        statusCode: 409,
        body: buildErrorEnvelope("An account already exists for this email address.", "EMAIL_ALREADY_REGISTERED", context.requestId),
      };
    }

    if (existingUser) {
      const updated = await store.updateUser(existingUser.id, {
        fullName: input.fullName.trim(),
        mobile: input.mobile.trim(),
        passwordHash,
        role: invitedSignup ? "NOMINEE" : existingUser.role,
        status: "ACTIVE",
        isEmailVerified: false,
        isMobileVerified: existingUser.isMobileVerified,
      });

      if (!updated) {
        return {
          statusCode: 500,
          body: buildErrorEnvelope("Registration could not be completed.", "REGISTRATION_FAILED", context.requestId),
        };
      }

      user = updated;
    } else {
      user = await store.createUser({
        fullName: input.fullName.trim(),
        email,
        mobile: input.mobile.trim(),
        passwordHash,
        role: invitedSignup ? "NOMINEE" : "CUSTOMER",
        status: "ACTIVE",
        isEmailVerified: false,
        isMobileVerified: false,
        mustResetPassword: false,
      });
    }

    const verificationToken = randomToken(32);
    await store.createAuthToken({
      userId: user.id,
      tokenHash: sha256Hex(verificationToken),
      purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      metadata: { email: user.email },
    });

    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.fullName);
    } catch (error) {
      logger.warn("Verification email delivery failed during registration", {
        userId: user.id,
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "REGISTERED",
      entityType: "user",
      entityId: user.id,
      newValue: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "REGISTERED",
      eventDescription: "A new INHERIX account was created.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 201,
      body: buildAuthEnvelope(
        "Registration successful. Please verify your email.",
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
        },
        context.requestId
      ),
    };
  }

  async function login(input: LoginInput, context: AuthRequestContext): Promise<AuthResponse> {
    if (!input.email.trim() || !input.password.trim()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("Email and password are required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const email = input.email.trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    const rateLimited = await enforceRateLimit(
      store,
      ["LOGIN_FAILED"],
      context.ipAddress,
      new Date(Date.now() - loginRateLimitWindowMs),
      10,
      "Too many login attempts. Please try again later.",
      context.requestId,
      user?.id ?? null
    );

    if (rateLimited) {
      return rateLimited;
    }

    const invitationNextPath = buildInvitationAcceptPath(input.invitationToken);

    if (!user || user.status !== "ACTIVE") {
      await logAuthEvent(store, {
        userId: user?.id ?? null,
        role: user?.role ?? null,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user?.id ?? null,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "LOGIN_FAILED",
        eventDescription: "Failed login attempt.",
        riskLevel: "MEDIUM",
      });

      return {
        statusCode: user?.status === "ACTIVE" ? 401 : 403,
        body: buildErrorEnvelope("Invalid email or password.", user?.status === "ACTIVE" ? "INVALID_CREDENTIALS" : "ACCOUNT_DISABLED", context.requestId),
      };
    }

    const matches = await verifyPassword(input.password, user.passwordHash);
    if (!matches) {
      await logAuthEvent(store, {
        userId: user.id,
        role: user.role,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user.id,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "LOGIN_FAILED",
        eventDescription: "Failed login attempt.",
        riskLevel: "MEDIUM",
      });

      return {
        statusCode: 401,
        body: buildErrorEnvelope("Invalid email or password.", "INVALID_CREDENTIALS", context.requestId),
      };
    }

    if (!user.isEmailVerified && privilegedRoles.has(user.role)) {
      await logAuthEvent(store, {
        userId: user.id,
        role: user.role,
        action: "LOGIN_BLOCKED_EMAIL_UNVERIFIED",
        entityType: "user",
        entityId: user.id,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "LOGIN_BLOCKED_EMAIL_UNVERIFIED",
        eventDescription: "Privileged sign-in blocked until email verification is complete.",
        riskLevel: "MEDIUM",
      });

      return {
        statusCode: 403,
        body: buildErrorEnvelope(
          "This privileged account must verify its email before signing in.",
          "EMAIL_VERIFICATION_REQUIRED",
          context.requestId
        ),
      };
    }

    if (user.mustResetPassword) {
      const sessionTokens = await issueSessionTokens(store, env, user, context);
      await store.touchLastLogin(user.id);

      await logAuthEvent(store, {
        userId: user.id,
        role: user.role,
        action: "PASSWORD_RESET_REQUIRED",
        entityType: "user",
        entityId: user.id,
        newValue: {
          email: user.email,
          role: user.role,
          mustResetPassword: true,
        },
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "PASSWORD_RESET_REQUIRED",
        eventDescription: "User must reset password before accessing the dashboard.",
        riskLevel: "MEDIUM",
      });

      return {
        statusCode: 200,
        refreshToken: sessionTokens.refreshToken,
        body: buildAuthEnvelope(
          "Password reset required.",
          {
            ...(await buildAuthenticatedUserPayload(
              { ...user, lastLoginAt: new Date().toISOString() },
              sessionTokens.accessToken,
              sessionTokens.sessionId,
              invitationNextPath
            )),
            passwordResetRequired: true,
            nextPath: "/onboarding/force-reset-password",
          },
          context.requestId
        ),
      };
    }

    if (requiresPrivilegedMfa(user)) {
      let mfaChallengeCode: string | null = null;

      try {
        mfaChallengeCode = await issueMfaChallenge(store, emailService, logger, user, context);
      } catch (error) {
        logger.warn("MFA challenge delivery failed", {
          userId: user.id,
          email: user.email,
          role: user.role,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await logAuthEvent(store, {
        userId: user.id,
        role: user.role,
        action: "MFA_CHALLENGE_SENT",
        entityType: "user",
        entityId: user.id,
        newValue: {
          email: user.email,
          role: user.role,
          privileged: privilegedRoles.has(user.role),
          mfaEnabled: user.mfaEnabled,
        },
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "MFA_CHALLENGE_SENT",
        eventDescription: "Privileged sign-in requires a verification code.",
        riskLevel: "LOW",
      });

      return {
        statusCode: 202,
        body: buildAuthEnvelope(
          "MFA verification required.",
          {
            mfaRequired: true,
            delivery: "EMAIL",
            email: user.email,
            role: user.role,
            nextPath: invitationNextPath ?? resolveDashboardLandingPath(user.role),
            ...(env.NODE_ENV !== "production" && mfaChallengeCode
              ? { mfaCodePreview: mfaChallengeCode }
              : {}),
          },
          context.requestId
        ),
      };
    }

    const sessionTokens = await issueSessionTokens(store, env, user, context);
    await store.touchLastLogin(user.id);

    const sessions = await store.listSessions(user.id);
    const currentSignature = buildSessionSignature({
      deviceInfo: context.deviceInfo,
      browserInfo: context.browserInfo,
      locationInfo: context.locationInfo,
    });
    const trustedDevice = sessions.find(
      (session) =>
        session.id !== sessionTokens.sessionId &&
        session.trustedAt &&
        !session.trustRevokedAt &&
        buildSessionSignature(session) === currentSignature
    );

    if (trustedDevice) {
      await store.trustSessionById(sessionTokens.sessionId, trustedDevice.trustLabel ?? context.deviceInfo ?? "Trusted device");
    } else if (sessions.some((session) => session.id !== sessionTokens.sessionId)) {
      await logAuthEvent(store, {
        userId: user.id,
        role: user.role,
        action: "SUSPICIOUS_LOGIN_DETECTED",
        entityType: "session",
        entityId: sessionTokens.sessionId,
        newValue: {
          ipAddress: context.ipAddress,
          browserInfo: context.browserInfo,
          deviceInfo: context.deviceInfo,
          locationInfo: context.locationInfo,
          reason: "New device or location detected.",
        },
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "SUSPICIOUS_LOGIN_DETECTED",
        eventDescription: "A new login was detected from a device that has not been trusted yet.",
        riskLevel: "HIGH",
      });
    }

    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "session",
      entityId: sessionTokens.sessionId,
      newValue: {
        ipAddress: context.ipAddress,
        browserInfo: context.browserInfo,
        deviceInfo: context.deviceInfo,
        locationInfo: context.locationInfo,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "LOGIN_SUCCESS",
      eventDescription: "User authenticated successfully.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      refreshToken: sessionTokens.refreshToken,
      body: buildAuthEnvelope(
        "Login successful.",
        await buildAuthenticatedUserPayload(
          { ...user, lastLoginAt: new Date().toISOString() },
          sessionTokens.accessToken,
          sessionTokens.sessionId,
          invitationNextPath
        ),
        context.requestId
      ),
    };
  }

  async function verifyMfaChallenge(input: MfaVerifyInput, context: AuthRequestContext): Promise<AuthResponse> {
    if (!input.email.trim() || !input.code.trim()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("Email and verification code are required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const email = input.email.trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    const rateLimited = await enforceRateLimit(
      store,
      ["MFA_CHALLENGE_FAILED"],
      context.ipAddress,
      new Date(Date.now() - loginRateLimitWindowMs),
      10,
      "Too many verification attempts. Please try again later.",
      context.requestId,
      user?.id ?? null
    );

    if (rateLimited) {
      return rateLimited;
    }

    const invitationNextPath = buildInvitationAcceptPath(input.invitationToken);
    if (!user || user.status !== "ACTIVE" || !requiresPrivilegedMfa(user)) {
      return {
        statusCode: 403,
        body: buildErrorEnvelope("This account cannot complete privileged sign-in.", "ACCOUNT_DISABLED", context.requestId),
      };
    }

    const tokenHash = sha256Hex(input.code.trim());
    const record = await store.findAuthToken(tokenHash, "MFA_CHALLENGE");
    if (!record || record.userId !== user.id || record.usedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      await logAuthEvent(store, {
        userId: user.id,
        role: user.role,
        action: "MFA_CHALLENGE_FAILED",
        entityType: "user",
        entityId: user.id,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "MFA_CHALLENGE_FAILED",
        eventDescription: "Invalid privileged sign-in code.",
        riskLevel: "MEDIUM",
      });

      return {
        statusCode: 401,
        body: buildErrorEnvelope("The verification code is invalid or has expired.", "INVALID_TOKEN", context.requestId),
      };
    }

    const sessionTokens = await issueSessionTokens(store, env, user, context);
    await store.consumeAuthToken(record.id);
    await store.touchLastLogin(user.id);

    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "MFA_CHALLENGE_VERIFIED",
      entityType: "session",
      entityId: sessionTokens.sessionId,
      newValue: {
        email: user.email,
        role: user.role,
        verified: true,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "MFA_CHALLENGE_VERIFIED",
      eventDescription: "Privileged sign-in code verified.",
      riskLevel: "LOW",
    });

    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "session",
      entityId: sessionTokens.sessionId,
      newValue: {
        ipAddress: context.ipAddress,
        browserInfo: context.browserInfo,
        deviceInfo: context.deviceInfo,
        locationInfo: context.locationInfo,
        privilegedMfa: true,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "LOGIN_SUCCESS",
      eventDescription: "User authenticated successfully after MFA.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      refreshToken: sessionTokens.refreshToken,
      body: buildAuthEnvelope(
        "Login successful.",
        await buildAuthenticatedUserPayload(
          { ...user, lastLoginAt: new Date().toISOString() },
          sessionTokens.accessToken,
          sessionTokens.sessionId,
          invitationNextPath
        ),
        context.requestId
      ),
    };
  }

  async function refresh(request: IncomingMessage, context: AuthRequestContext): Promise<AuthResponse> {
    const rateLimited = await enforceRateLimit(
      store,
      ["TOKEN_REFRESHED"],
      context.ipAddress,
      new Date(Date.now() - refreshRateLimitWindowMs),
      30,
      "Too many token refresh attempts. Please try again later.",
      context.requestId
    );

    if (rateLimited) {
      return rateLimited;
    }

    const refreshToken = getCookieToken(request, env.AUTH_COOKIE_NAME);
    if (!refreshToken) {
      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    const payload = validateRefreshToken(refreshToken, env);
    if (!payload) {
      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    const session = await store.findSessionById(payload.sessionId ?? "");
    if (!session || !session.isActive || session.refreshTokenHash !== sha256Hex(refreshToken)) {
      if (session?.id) {
        await store.revokeSession(session.id);
      }

      await logAuthEvent(store, {
        userId: payload.sub ?? null,
        role: null,
        action: "TOKEN_REFRESHED",
        entityType: "session",
        entityId: payload.sessionId ?? null,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "TOKEN_REFRESHED",
        eventDescription: "Invalid refresh token reuse detected.",
        riskLevel: "HIGH",
      });

      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await store.revokeSession(session.id);
      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    const user = await store.findUserById(payload.sub ?? "");
    if (!user || user.status !== "ACTIVE") {
      return {
        statusCode: 403,
        body: buildErrorEnvelope("Account access is not available.", "ACCOUNT_DISABLED", context.requestId),
      };
    }

    const nextRefreshToken = createRefreshToken(user, session.id, env);
    const nextAccessToken = createAccessToken(user, session.id, env);
    await store.rotateSession(session.id, sha256Hex(nextRefreshToken), new Date(Date.now() + getRefreshTokenTtl(env)));

    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "TOKEN_REFRESHED",
      entityType: "session",
      entityId: session.id,
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "TOKEN_REFRESHED",
      eventDescription: "Access token rotated successfully.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      refreshToken: nextRefreshToken,
      body: buildAuthEnvelope(
        "Token refreshed.",
        await buildAuthenticatedUserPayload(user, nextAccessToken),
        context.requestId
      ),
    };
  }

  async function logout(request: IncomingMessage, context: AuthRequestContext): Promise<AuthResponse> {
    const authenticated = await resolveSessionFromRequest(request, context, env, store);
    if (!authenticated?.user) {
      return {
        statusCode: 200,
        clearRefreshCookie: true,
        body: buildAuthEnvelope("Logged out successfully.", { nextPath: "/onboarding/login" }, context.requestId),
      };
    }

    if (authenticated.session) {
      await store.revokeSession(authenticated.session.id);
      await logAuthEvent(store, {
        userId: authenticated.user.id,
        role: authenticated.user.role,
        action: "LOGOUT",
        entityType: "session",
        entityId: authenticated.session.id,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "LOGOUT",
        eventDescription: "User logged out.",
        riskLevel: "LOW",
      });
    }

    return {
      statusCode: 200,
      clearRefreshCookie: true,
      body: buildAuthEnvelope("Logged out successfully.", { nextPath: "/onboarding/login" }, context.requestId),
    };
  }

  async function me(request: IncomingMessage, context: AuthRequestContext): Promise<AuthResponse> {
    const authenticated = await resolveSessionFromRequest(request, context, env, store);

    if (!authenticated?.user) {
      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    return {
      statusCode: 200,
      body: buildAuthEnvelope(
        "Authenticated user retrieved.",
        await buildAuthenticatedUserPayload(
          authenticated.user,
          authenticated.authenticatedBy === "refresh" ? authenticated.accessToken : undefined,
          authenticated.session?.id
        ),
        context.requestId
      ),
    };
  }

  async function forceResetPassword(input: ResetPasswordInput & { currentPassword?: string }, context: AuthRequestContext, request: IncomingMessage): Promise<AuthResponse> {
    if (!input.password.trim()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("New password is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const authenticated = await resolveSessionFromRequest(request, context, env, store);
    if (!authenticated?.user) {
      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    const user = authenticated.user;
    if (!user.mustResetPassword) {
      return {
        statusCode: 409,
        body: buildErrorEnvelope("This account does not require a password reset.", "PASSWORD_RESET_NOT_REQUIRED", context.requestId),
      };
    }

    const passwordViolations = passwordPolicyViolations(input.password);
    if (passwordViolations.length) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope(passwordViolations[0] ?? "Password policy failed.", "PASSWORD_POLICY_VIOLATION", context.requestId),
      };
    }

    const passwordHash = await hashPassword(input.password);
    await store.updateUser(user.id, { passwordHash, mustResetPassword: false });
    await store.revokeAllUserSessions(user.id, "Password reset completed");
    const sessionTokens = await issueSessionTokens(store, env, user, context);

    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "user",
      entityId: user.id,
      newValue: { passwordUpdated: true, mustResetPassword: false },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "PASSWORD_RESET_COMPLETED",
      eventDescription: "First-login password reset completed.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      refreshToken: sessionTokens.refreshToken,
      body: buildAuthEnvelope(
        "Password updated successfully.",
        { reset: true, nextPath: resolveDashboardLandingPath(user.role), passwordResetRequired: false },
        context.requestId
      ),
    };
  }

  async function sessions(request: IncomingMessage, context: AuthRequestContext): Promise<AuthResponse> {
    const authenticated = await resolveSessionFromRequest(request, context, env, store);
    if (!authenticated?.user) {
      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    const sessions = await store.listActiveSessions(authenticated.user.id);
    return {
      statusCode: 200,
      body: buildAuthEnvelope(
        "Sessions retrieved.",
        {
          sessions,
        },
        context.requestId
      ),
    };
  }

  async function revokeSession(request: IncomingMessage, context: AuthRequestContext, sessionId: string): Promise<AuthResponse> {
    const authenticated = await resolveSessionFromRequest(request, context, env, store);
    if (!authenticated?.user) {
      return {
        statusCode: 401,
        body: buildErrorEnvelope("Authentication is required.", "UNAUTHORIZED", context.requestId),
      };
    }

    const target = await store.findSessionById(sessionId);
    if (!target || target.userId !== authenticated.user.id) {
      return {
        statusCode: 404,
        body: buildErrorEnvelope("Session not found.", "SESSION_NOT_FOUND", context.requestId),
      };
    }

    await store.revokeSession(sessionId);
    await logAuthEvent(store, {
      userId: authenticated.user.id,
      role: authenticated.user.role,
      action: "SESSION_REVOKED",
      entityType: "session",
      entityId: sessionId,
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "SESSION_REVOKED",
      eventDescription: "A session was revoked by the user.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      body: buildAuthEnvelope("Session revoked.", { sessionId }, context.requestId),
    };
  }

  async function requestEmailVerification(
    request: IncomingMessage,
    input: VerificationRequestInput,
    context: AuthRequestContext
  ): Promise<AuthResponse> {
    if (!input.email && !request.headers.authorization && !request.headers.cookie) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("An email address is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const rateLimited = await enforceRateLimit(
      store,
      ["EMAIL_VERIFICATION_REQUESTED"],
      context.ipAddress,
      new Date(Date.now() - forgotPasswordRateLimitWindowMs),
      5,
      "Too many verification requests. Please try again later.",
      context.requestId
    );

    if (rateLimited) {
      return rateLimited;
    }

    let user: UserRecord | null = null;
    let email = input.email?.trim().toLowerCase() ?? "";

    const authenticated = await resolveSessionFromRequest(request, context, env, store);
    if (authenticated?.user) {
      user = authenticated.user;
      email = user.email;
    } else if (email) {
      user = await store.findUserByEmail(email);
    }

    if (user) {
      const token = randomToken(32);
      await store.createAuthToken({
        userId: user.id,
        tokenHash: sha256Hex(token),
        purpose: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        metadata: { email: user.email },
      });

      try {
        await emailService.sendVerificationEmail(user.email, token, user.fullName);
      } catch (error) {
        logger.warn("Verification email delivery failed", {
          userId: user.id,
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await logAuthEvent(store, {
        userId: user.id,
        role: user.role,
        action: "EMAIL_VERIFICATION_REQUESTED",
        entityType: "user",
        entityId: user.id,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        eventType: "EMAIL_VERIFICATION_REQUESTED",
        eventDescription: "Verification email requested.",
        riskLevel: "LOW",
      });
    }

    return {
      statusCode: 200,
      body: buildAuthEnvelope(
        "If the email address exists, a verification link has been sent.",
        { email: email || null },
        context.requestId
      ),
    };
  }

  async function verifyEmail(input: VerifyEmailInput, context: AuthRequestContext): Promise<AuthResponse> {
    if (!input.token.trim()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("The verification token is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const tokenHash = sha256Hex(input.token);
    const record = await store.findAuthToken(tokenHash, "EMAIL_VERIFICATION");

    if (!record || record.usedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("The verification link is invalid or has expired.", "INVALID_TOKEN", context.requestId),
      };
    }

    const userId = record.userId;
    const user = userId ? await store.findUserById(userId) : null;

    if (!user) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("The verification link is invalid or has expired.", "INVALID_TOKEN", context.requestId),
      };
    }

    if (!user.isEmailVerified) {
      await store.updateUser(user.id, { isEmailVerified: true });
    }

    await store.consumeAuthToken(record.id);
    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "EMAIL_VERIFIED",
      entityType: "user",
      entityId: user.id,
      newValue: { isEmailVerified: true },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "EMAIL_VERIFIED",
      eventDescription: "Email address verified.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      body: buildAuthEnvelope("Email verified successfully.", { verified: true }, context.requestId),
    };
  }

  async function forgotPassword(input: ForgotPasswordInput, context: AuthRequestContext): Promise<AuthResponse> {
    if (!input.email.trim()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("Email is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const rateLimited = await enforceRateLimit(
      store,
      ["PASSWORD_RESET_REQUESTED"],
      context.ipAddress,
      new Date(Date.now() - forgotPasswordRateLimitWindowMs),
      5,
      "Too many password reset requests. Please try again later.",
      context.requestId
    );

    if (rateLimited) {
      return rateLimited;
    }

    const email = input.email.trim().toLowerCase();
    const user = await store.findUserByEmail(email);

    if (user && user.status === "ACTIVE") {
      const token = randomToken(32);
      await store.createAuthToken({
        userId: user.id,
        tokenHash: sha256Hex(token),
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        metadata: { email: user.email },
      });

      try {
        await emailService.sendPasswordResetEmail(user.email, token, user.fullName);
      } catch (error) {
        logger.warn("Password reset email delivery failed", {
          userId: user.id,
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await logAuthEvent(store, {
      userId: user?.id ?? null,
      role: user?.role ?? null,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "user",
      entityId: user?.id ?? null,
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "PASSWORD_RESET_REQUESTED",
      eventDescription: "Password reset requested.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      body: buildAuthEnvelope(
        "If the email address exists, a password reset link has been sent.",
        { email },
        context.requestId
      ),
    };
  }

  async function resetPassword(input: ResetPasswordInput, context: AuthRequestContext): Promise<AuthResponse> {
    if (!input.token.trim() || !input.password.trim()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("Reset token and password are required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const rateLimited = await enforceRateLimit(
      store,
      ["PASSWORD_RESET_COMPLETED"],
      context.ipAddress,
      new Date(Date.now() - forgotPasswordRateLimitWindowMs),
      10,
      "Too many password reset attempts. Please try again later.",
      context.requestId
    );

    if (rateLimited) {
      return rateLimited;
    }

    const passwordViolations = passwordPolicyViolations(input.password);
    if (passwordViolations.length) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope(passwordViolations[0] ?? "Password policy failed.", "PASSWORD_POLICY_VIOLATION", context.requestId),
      };
    }

    const tokenHash = sha256Hex(input.token);
    const record = await store.findAuthToken(tokenHash, "PASSWORD_RESET");
    if (!record || record.usedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("The reset link is invalid or has expired.", "INVALID_TOKEN", context.requestId),
      };
    }

    const user = record.userId ? await store.findUserById(record.userId) : null;
    if (!user) {
      return {
        statusCode: 400,
        body: buildErrorEnvelope("The reset link is invalid or has expired.", "INVALID_TOKEN", context.requestId),
      };
    }

    const passwordHash = await hashPassword(input.password);
    await store.updateUser(user.id, { passwordHash });
    await store.revokeAllUserSessions(user.id);
    await store.consumeAuthToken(record.id);

    await logAuthEvent(store, {
      userId: user.id,
      role: user.role,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "user",
      entityId: user.id,
      newValue: { passwordUpdated: true, sessionsRevoked: true },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: "PASSWORD_RESET_COMPLETED",
      eventDescription: "Password reset completed and sessions revoked.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      body: buildAuthEnvelope("Password updated successfully.", { reset: true }, context.requestId),
    };
  }

  return {
    register,
    login,
    verifyMfaChallenge,
    refresh,
    logout,
    me,
    sessions,
    revokeSession,
    requestEmailVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
    forceResetPassword,
    getAuthSnapshot: async (request: IncomingMessage, context: AuthRequestContext) => resolveSessionFromRequest(request, context, env, store),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
