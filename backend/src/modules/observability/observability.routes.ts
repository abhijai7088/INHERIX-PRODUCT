import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { getPool } from "../../db/pool.js";
import { HttpError, buildErrorResponse, buildSuccessResponse, readJsonBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createAuthService } from "../auth/auth.service.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext } from "../auth/types.js";
import { createObservabilityService, type ObservabilityService } from "./observability.service.js";
import { createPostgresObservabilityStore } from "./observability.store.js";
import { createPostgresReleaseStore } from "../release/release.store.js";
import { createPostgresTriggerStore } from "../trigger/trigger.store.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type ObservabilityDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<{
    user: { id: string; email: string; role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN"; fullName?: string };
    session: { id: string } | null;
    accessToken: string;
    authenticatedBy: "access" | "refresh";
  } | null>;
  observabilityService?: ObservabilityService;
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
  dependencies?: ObservabilityDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

function getObservabilityService(routeContext: RouteContext, dependencies?: ObservabilityDependencies) {
  if (dependencies?.observabilityService) {
    return dependencies.observabilityService;
  }

  const pool = getPool(routeContext.env);
  const observabilityStore = createPostgresObservabilityStore(pool);
  const authStore = createPostgresAuthStore(pool);
  const triggerStore = createPostgresTriggerStore(pool);
  const releaseStore = createPostgresReleaseStore(pool);
  return createObservabilityService(routeContext.env, routeContext.logger, {
    ...observabilityStore,
    insertAuditLog: authStore.insertAuditLog,
    insertSecurityEvent: authStore.insertSecurityEvent,
    listPermissionsForUser: authStore.listPermissionsForUser,
    listRolePermissions: authStore.listRolePermissions,
    createAuthToken: authStore.createAuthToken,
    findUserByEmail: authStore.findUserByEmail,
    findUserById: authStore.findUserById,
    updateUser: authStore.updateUser,
    listRequestsForAdmin: triggerStore.listRequestsForAdmin,
    listReleasesForAdmin: releaseStore.listReleasesForAdmin,
  });
}

function parseLimit(url: URL, defaultLimit = 25) {
  const raw = Number(url.searchParams.get("limit") ?? defaultLimit);
  if (!Number.isFinite(raw) || raw <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.trunc(raw), 1), 100);
}

export async function handleObservabilityRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: ObservabilityDependencies
) {
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);
  const service = getObservabilityService(context, dependencies);
  const url = new URL(request.url ?? "/", "http://localhost");

  function parseDateParam(value: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function csvEscape(value: unknown) {
    const normalized = value == null ? "" : String(value);
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  }

  function writeCsv(response: ServerResponse, filename: string, rows: Array<Record<string, unknown>>) {
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const lines = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ];

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.end(`${lines.join("\n")}\n`);
  }

  if (!principal) {
    writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/audit-logs") {
    const limit = parseLimit(url, 25);
    const payload = await service.listAuditLogs(principal, limit);
    const complianceReports = await service.getComplianceReports(principal).catch(() => []);

    writeJson(
      response,
      200,
      buildSuccessResponse("Audit logs retrieved.", { ...payload, complianceReports }, context.requestId)
    );
    return;
  }

  if (request.method === "GET" && routePath === "/audit-logs/export") {
    const payload = await service.exportAuditLogs(principal, {
      action: url.searchParams.get("action"),
      moduleName: url.searchParams.get("module"),
      fromDate: url.searchParams.get("fromDate"),
      toDate: url.searchParams.get("toDate"),
    });

    writeCsv(
      response,
      "inherix-audit-logs.csv",
      payload.rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt,
        actor: row.actor,
        role: row.actorRole ?? "",
        domain: row.domain,
        module: row.moduleName ?? "",
        action: row.type,
        subject: row.subject,
        details: row.details,
        outcome: row.outcome,
        severity: row.severity,
      }))
    );
    return;
  }

  if (request.method === "GET" && routePath === "/event-log") {
    const limit = parseLimit(url, 25);
    const payload = await service.getEventLog(principal, limit);

    writeJson(response, 200, buildSuccessResponse("Event log retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && (routePath === "/security/events" || routePath === "/security-events")) {
    const limit = parseLimit(url, 25);
    const payload = await service.listSecurityEvents(principal, limit);

    writeJson(response, 200, buildSuccessResponse("Security events retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && (routePath === "/security/sessions" || routePath === "/security-sessions")) {
    const limit = parseLimit(url, 25);
    const payload = await service.listSecuritySessions(principal, limit);

    writeJson(
      response,
      200,
      buildSuccessResponse(
        "Security sessions retrieved.",
        payload,
        context.requestId
      )
    );
    return;
  }

  if (request.method === "GET" && routePath === "/security/devices") {
    const limit = parseLimit(url, 25);
    const payload = await service.listSecurityDevices(principal, limit);

    writeJson(response, 200, buildSuccessResponse("Security devices retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/security/devices/revoke") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.trim() : "";

    if (!deviceId) {
      throw new HttpError(400, "VALIDATION_ERROR", "deviceId is required.");
    }

    const result = await service.revokeSecurityDevice(principal, deviceId);
    writeJson(response, 200, buildSuccessResponse("Security device revoked.", result, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/notifications") {
    const limit = parseLimit(url, 25);
    const payload = await service.listNotifications(principal, limit);

    writeJson(response, 200, buildSuccessResponse("Notifications retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/notifications/read-all") {
    const payload = await service.markAllNotificationsRead(principal);
    writeJson(response, 200, buildSuccessResponse("Notifications marked as read.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/notifications/") && routePath.endsWith("/read")) {
    const notificationId = routePath.slice("/notifications/".length, -"/read".length);
    if (!notificationId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const payload = await service.markNotificationRead(principal, notificationId);
    writeJson(response, 200, buildSuccessResponse("Notification marked as read.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/governance") {
    const payload = await service.getGovernanceSnapshot(principal);
    const complianceReports = await service.getComplianceReports(principal);

    writeJson(
      response,
      200,
      buildSuccessResponse("Governance snapshot retrieved.", { dashboard: payload, complianceReports }, context.requestId)
    );
    return;
  }

  if (request.method === "GET" && routePath === "/admin/dashboard") {
    const payload = await service.getAdminDashboard(principal);
    writeJson(response, 200, buildSuccessResponse("Admin dashboard retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/admin/reports") {
    const payload = await service.getAdminReports(principal);
    writeJson(response, 200, buildSuccessResponse("Admin reports retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/admin/settings") {
    const payload = await service.getAdminSettings(principal);
    writeJson(response, 200, buildSuccessResponse("Admin settings retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/admin/settings") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const updates = Array.isArray(payload.updates)
      ? payload.updates
          .map((item) => ({
            key: typeof item === "object" && item && typeof (item as Record<string, unknown>).key === "string" ? String((item as Record<string, unknown>).key) : "",
            value: typeof item === "object" && item && typeof (item as Record<string, unknown>).value !== "undefined"
              ? String((item as Record<string, unknown>).value)
              : "",
          }))
          .filter((item) => item.key && item.value !== undefined)
      : [];

    if (!updates.length) {
      throw new HttpError(400, "VALIDATION_ERROR", "updates are required.");
    }

    const result = await service.updateAdminSettings(principal, updates, requestContext);
    writeJson(response, 200, buildSuccessResponse("Admin settings updated.", result, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/admin/admins") {
    const payload = await service.listAdminAccounts(principal);
    writeJson(response, 200, buildSuccessResponse("Admin accounts retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/admin/admins") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await service.createAdminAccount(
      principal,
      {
        fullName: typeof payload.fullName === "string" ? payload.fullName : "",
        email: typeof payload.email === "string" ? payload.email : "",
        mobile: typeof payload.mobile === "string" ? payload.mobile : null,
        role: typeof payload.role === "string" ? payload.role : "ADMIN",
      },
      requestContext
    );

    writeJson(response, 201, buildSuccessResponse("Admin account created.", result, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/admin/officers") {
    const payload = await service.listVerificationOfficers(principal);
    writeJson(response, 200, buildSuccessResponse("Verification officers retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/admin/officers") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await service.createVerificationOfficerAccount(
      principal,
      {
        fullName: typeof payload.fullName === "string" ? payload.fullName : "",
        email: typeof payload.email === "string" ? payload.email : "",
        mobile: typeof payload.mobile === "string" ? payload.mobile : null,
        role: typeof payload.role === "string" ? payload.role : "VERIFICATION_OFFICER",
      },
      requestContext
    );

    writeJson(response, 201, buildSuccessResponse("Verification officer created.", result, context.requestId));
    return;
  }

  if (request.method === "PATCH" && routePath.startsWith("/admin/officers/")) {
    const officerId = routePath.slice("/admin/officers/".length);
    if (!officerId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await service.updateVerificationOfficerAccount(
      principal,
      officerId,
      {
        fullName: typeof payload.fullName === "string" ? payload.fullName : undefined,
        mobile: typeof payload.mobile === "string" ? payload.mobile : undefined,
        status:
          typeof payload.status === "string"
            ? (payload.status as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DECEASED")
            : undefined,
        isEmailVerified: typeof payload.isEmailVerified === "boolean" ? payload.isEmailVerified : undefined,
        isMobileVerified: typeof payload.isMobileVerified === "boolean" ? payload.isMobileVerified : undefined,
        mfaEnabled: typeof payload.mfaEnabled === "boolean" ? payload.mfaEnabled : undefined,
        mustResetPassword: typeof payload.mustResetPassword === "boolean" ? payload.mustResetPassword : undefined,
      },
      requestContext
    );

    writeJson(response, 200, buildSuccessResponse("Verification officer updated.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/admin/officers/") && routePath.endsWith("/resend-verification")) {
    const officerId = routePath.slice("/admin/officers/".length, -"/resend-verification".length);
    if (!officerId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const result = await service.resendVerificationEmail(principal, officerId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Verification email resent.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/admin/officers/") && routePath.endsWith("/reissue-credentials")) {
    const officerId = routePath.slice("/admin/officers/".length, -"/reissue-credentials".length);
    if (!officerId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const result = await service.reissueVerificationOfficerCredentials(principal, officerId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Verification officer credentials reissued.", result, context.requestId));
    return;
  }

  if (request.method === "PATCH" && routePath.startsWith("/admin/admins/")) {
    const adminId = routePath.slice("/admin/admins/".length);
    if (!adminId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);
    const payload = body as Record<string, unknown>;
    const result = await service.updateAdminAccount(
      principal,
      adminId,
      {
        fullName: typeof payload.fullName === "string" ? payload.fullName : undefined,
        mobile: typeof payload.mobile === "string" ? payload.mobile : undefined,
        role: typeof payload.role === "string" ? payload.role : undefined,
        status:
          typeof payload.status === "string"
            ? (payload.status as "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DECEASED")
            : undefined,
        mfaEnabled: typeof payload.mfaEnabled === "boolean" ? payload.mfaEnabled : undefined,
        isEmailVerified: typeof payload.isEmailVerified === "boolean" ? payload.isEmailVerified : undefined,
        isMobileVerified: typeof payload.isMobileVerified === "boolean" ? payload.isMobileVerified : undefined,
      },
      requestContext
    );

    writeJson(response, 200, buildSuccessResponse("Admin account updated.", result, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/admin/backup") {
    const payload = await service.getBackupSnapshot(principal);
    writeJson(response, 200, buildSuccessResponse("Backup snapshot retrieved.", payload, context.requestId));
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
