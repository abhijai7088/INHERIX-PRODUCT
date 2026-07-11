import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { getPool } from "../../db/pool.js";
import { sha256Hex } from "../../lib/crypto.js";
import { HttpError, readJsonBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createAuthService } from "./auth.service.js";
import { createPostgresNomineeStore } from "../nominee/nominee.store.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

const browserSessionCookieName = "inherix_browser_session";

function createContext(request: IncomingMessage, requestId: string) {
  const userAgent = getUserAgent(request);
  const { browserInfo, deviceInfo } = parseClientInfo(userAgent);

  return {
    requestId,
    ipAddress: getRequestIp(request),
    userAgent,
    browserInfo,
    deviceInfo,
    locationInfo: getLocationInfo(request),
  };
}

export function serializeRefreshCookie(refreshToken: string, env: AppEnv) {
  return `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=${env.AUTH_COOKIE_SAME_SITE}${env.AUTH_COOKIE_SECURE ? "; Secure" : ""}${env.AUTH_COOKIE_DOMAIN ? `; Domain=${env.AUTH_COOKIE_DOMAIN}` : ""}`;
}

export function serializeBrowserSessionCookie(env: AppEnv) {
  return `${browserSessionCookieName}=1; Path=/; HttpOnly; SameSite=${env.AUTH_COOKIE_SAME_SITE}${env.AUTH_COOKIE_SECURE ? "; Secure" : ""}${env.AUTH_COOKIE_DOMAIN ? `; Domain=${env.AUTH_COOKIE_DOMAIN}` : ""}`;
}

function serializeClearRefreshCookie(env: AppEnv) {
  return `${env.AUTH_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=${env.AUTH_COOKIE_SAME_SITE}${env.AUTH_COOKIE_SECURE ? "; Secure" : ""}${env.AUTH_COOKIE_DOMAIN ? `; Domain=${env.AUTH_COOKIE_DOMAIN}` : ""}`;
}

function serializeClearBrowserSessionCookie(env: AppEnv) {
  return `${browserSessionCookieName}=; Path=/; HttpOnly; Max-Age=0; SameSite=${env.AUTH_COOKIE_SAME_SITE}${env.AUTH_COOKIE_SECURE ? "; Secure" : ""}${env.AUTH_COOKIE_DOMAIN ? `; Domain=${env.AUTH_COOKIE_DOMAIN}` : ""}`;
}

export async function handleAuthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string
) {
  if (!context.env.DATABASE_URL) {
    writeJson(
      response,
      503,
      {
        success: false,
        message: "Database configuration is required for auth endpoints.",
        errorCode: "DATABASE_UNAVAILABLE",
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
      }
    );
    return;
  }

  const auth = createAuthService(context.env, context.logger);
  const nomineeStore = createPostgresNomineeStore(getPool(context.env));
  const requestContext = createContext(request, context.requestId);

  if (request.method === "POST" && routePath === "/auth/register") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const invitationToken = typeof payload.invitationToken === "string" ? payload.invitationToken.trim() : "";

    if (invitationToken) {
      const tokenHash = sha256Hex(invitationToken);
      const nominee = await nomineeStore.findNomineeByInvitationTokenHash(tokenHash);

      if (!nominee) {
        throw new HttpError(400, "INVALID_TOKEN", "The invitation token is invalid or has expired.");
      }

      const expiry = nominee.invitationExpiresAt ? new Date(nominee.invitationExpiresAt).getTime() : new Date(nominee.invitedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
      if (Date.now() > expiry) {
        throw new HttpError(400, "INVITATION_EXPIRED", "The invitation token has expired.");
      }

      if (nominee.email && typeof payload.email === "string" && nominee.email.toLowerCase() !== payload.email.trim().toLowerCase()) {
        throw new HttpError(403, "FORBIDDEN", "The invitation email does not match the invited account.");
      }
    }

    const result = await auth.register(
      {
        fullName: typeof payload.fullName === "string" ? payload.fullName : "",
        email: typeof payload.email === "string" ? payload.email : "",
        mobile: typeof payload.mobile === "string" ? payload.mobile : "",
        password: typeof payload.password === "string" ? payload.password : "",
        invitationToken: invitationToken || null,
      },
      requestContext
    );

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/login") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await auth.login(
      {
        email: typeof payload.email === "string" ? payload.email : "",
        password: typeof payload.password === "string" ? payload.password : "",
        invitationToken: typeof payload.invitationToken === "string" ? payload.invitationToken : null,
      },
      requestContext
    );

    if (result.refreshToken) {
      response.setHeader("Set-Cookie", [serializeRefreshCookie(result.refreshToken, context.env), serializeBrowserSessionCookie(context.env)]);
    }

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/mfa/verify") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await auth.verifyMfaChallenge(
      {
        email: typeof payload.email === "string" ? payload.email : "",
        code: typeof payload.code === "string" ? payload.code : "",
        invitationToken: typeof payload.invitationToken === "string" ? payload.invitationToken : null,
      },
      requestContext
    );

    if (result.refreshToken) {
      response.setHeader("Set-Cookie", [serializeRefreshCookie(result.refreshToken, context.env), serializeBrowserSessionCookie(context.env)]);
    }

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/refresh-token") {
    const result = await auth.refresh(request, requestContext);

    if (result.refreshToken) {
      response.setHeader("Set-Cookie", [serializeRefreshCookie(result.refreshToken, context.env), serializeBrowserSessionCookie(context.env)]);
    }

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/logout") {
    const result = await auth.logout(request, requestContext);
    if (result.clearRefreshCookie) {
      response.setHeader("Set-Cookie", [serializeClearRefreshCookie(context.env), serializeClearBrowserSessionCookie(context.env)]);
    }
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/forgot-password") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await auth.forgotPassword(
      {
        email: typeof payload.email === "string" ? payload.email : "",
      },
      requestContext
    );
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/reset-password") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await auth.resetPassword(
      {
        token: typeof payload.token === "string" ? payload.token : "",
        password: typeof payload.password === "string" ? payload.password : "",
      },
      requestContext
    );
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/force-reset-password") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await auth.forceResetPassword(
      {
        token: "",
        password: typeof payload.password === "string" ? payload.password : "",
        currentPassword: typeof payload.currentPassword === "string" ? payload.currentPassword : undefined,
      },
      requestContext,
      request
    );
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/verify-email/request") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await auth.requestEmailVerification(
      request,
      {
        email: typeof payload.email === "string" ? payload.email : undefined,
      },
      requestContext
    );
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/auth/verify-email") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await auth.verifyEmail(
      {
        token: typeof payload.token === "string" ? payload.token : "",
      },
      requestContext
    );
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "GET" && routePath === "/auth/me") {
    const result = await auth.me(request, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "GET" && routePath === "/auth/sessions") {
    const result = await auth.sessions(request, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/auth/sessions/")) {
    const sessionId = routePath.slice("/auth/sessions/".length);
    if (!sessionId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const result = await auth.revokeSession(request, requestContext, sessionId);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
