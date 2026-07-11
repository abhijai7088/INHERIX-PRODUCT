import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { getPool } from "../../db/pool.js";
import { createAuthService } from "../auth/auth.service.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext } from "../auth/types.js";
import { buildErrorResponse, buildSuccessResponse, readJsonBody, writeJson, HttpError } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createRbacService } from "../rbac/rbac.service.js";
import { createPostgresObservabilityStore } from "../observability/observability.store.js";
import { createPostgresProfileStore } from "./profile.store.js";
import { createProfileService, type ProfileService } from "./profile.service.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type ProfileDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<{
    user: { id: string; email: string; role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN"; fullName?: string };
    session: { id: string } | null;
    accessToken: string;
    authenticatedBy: "access" | "refresh";
  } | null>;
  profileService?: ProfileService;
};

function buildError(message: string, errorCode: string, requestId: string) {
  return buildErrorResponse(message, errorCode, requestId);
}

function toRequestContext(request: IncomingMessage, requestId: string): AuthRequestContext {
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

async function resolvePrincipal(
  request: IncomingMessage,
  context: AuthRequestContext,
  routeContext: RouteContext,
  dependencies?: ProfileDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

function getProfileService(routeContext: RouteContext, dependencies?: ProfileDependencies) {
  if (dependencies?.profileService) {
    return dependencies.profileService;
  }

  const pool = getPool(routeContext.env);
  const authStore = createPostgresAuthStore(pool);
  const observabilityStore = createPostgresObservabilityStore(pool);
  const profileStore = createPostgresProfileStore(pool);
  return createProfileService(routeContext.env, routeContext.logger, {
    authStore,
    observabilityStore,
    profileStore,
    rbacService: createRbacService(authStore),
  });
}

function parseBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export async function handleProfileRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: ProfileDependencies
) {
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);
  const service = getProfileService(context, dependencies);

  if (!principal) {
    writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/profile") {
    const result = await service.getProfile(principal, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "PUT" && routePath === "/profile/account") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const result = await service.updateAccount(
      principal,
      {
        fullName: typeof body.fullName === "string" ? body.fullName : "",
        mobile: typeof body.mobile === "string" ? body.mobile : null,
      },
      requestContext
    );

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "PUT" && routePath === "/profile/notifications") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const result = await service.updateNotificationPreferences(
      principal,
      {
        emailEnabled: parseBoolean(body.emailEnabled),
        smsEnabled: parseBoolean(body.smsEnabled),
        inAppEnabled: parseBoolean(body.inAppEnabled),
        workflowEnabled: parseBoolean(body.workflowEnabled),
        securityEnabled: parseBoolean(body.securityEnabled),
        releaseEnabled: parseBoolean(body.releaseEnabled),
        complianceEnabled: parseBoolean(body.complianceEnabled),
      },
      requestContext
    );

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "PUT" && routePath === "/profile/privacy") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const result = await service.updatePrivacyPreferences(
      principal,
      {
        shareContactWithNominees: parseBoolean(body.shareContactWithNominees),
        shareActivityWithNominees: parseBoolean(body.shareActivityWithNominees),
        allowDataExports: parseBoolean(body.allowDataExports),
        allowTrustedDeviceTracking: parseBoolean(body.allowTrustedDeviceTracking),
      },
      requestContext
    );

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/profile/privacy/export") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const result = await service.requestPrivacyDataExport(
      principal,
      {
        reason: typeof body.reason === "string" ? body.reason : null,
      },
      requestContext
    );

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/profile/privacy/deletion-request") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const result = await service.requestPrivacyDeletion(
      principal,
      {
        reason: typeof body.reason === "string" ? body.reason : null,
      },
      requestContext
    );

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/profile/security/change-password") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const result = await service.changePassword(
      principal,
      {
        currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
        newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
      },
      requestContext
    );

    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/profile/security/mfa/enable") {
    const result = await service.setMfaEnabled(principal, true, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/profile/security/mfa/disable") {
    const result = await service.setMfaEnabled(principal, false, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "GET" && routePath === "/profile/security/sessions") {
    const result = await service.getProfile(principal, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/profile/security/sessions/")) {
    const sessionId = routePath.slice("/profile/security/sessions/".length);
    if (!sessionId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const result = await service.revokeSession(principal, sessionId, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/profile/security/sessions/revoke-all") {
    const result = await service.revokeAllSessions(principal, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath === "/profile/security/recovery-codes/rotate") {
    const result = await service.rotateRecoveryCodes(principal, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/profile/security/trusted-devices/") && routePath.endsWith("/trust")) {
    const sessionId = routePath.slice("/profile/security/trusted-devices/".length, -"/trust".length);
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const result = await service.trustDevice(
      principal,
      sessionId,
      typeof body.label === "string" ? body.label : null,
      requestContext
    );
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/profile/security/trusted-devices/") && routePath.endsWith("/trust")) {
    const sessionId = routePath.slice("/profile/security/trusted-devices/".length, -"/trust".length);
    const result = await service.revokeTrustedDevice(principal, sessionId, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/profile/security/alerts/") && routePath.endsWith("/acknowledge")) {
    const eventId = routePath.slice("/profile/security/alerts/".length, -"/acknowledge".length);
    const result = await service.acknowledgeSecurityAlert(principal, eventId, requestContext);
    writeJson(response, result.statusCode, result.body);
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
