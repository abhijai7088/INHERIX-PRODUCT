import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { createAuthService } from "../auth/auth.service.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext, UserRole } from "../auth/types.js";
import { getPool } from "../../db/pool.js";
import { HttpError, buildErrorResponse, buildSuccessResponse, readJsonBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { RBAC_PERMISSION_KEYS, type RbacPermissionKey } from "./permissions.js";
import {
  createRbacService,
  type AuthenticatedPrincipal,
  type RbacStore,
} from "./rbac.service.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type RbacDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<AuthenticatedPrincipal | null>;
  rbacStore?: RbacStore;
};

type RolePermissionChangeInput = {
  role: UserRole;
  permissionKeys: RbacPermissionKey[];
};

const allowedRoles = new Set<UserRole>(["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"]);

function buildRbacError(message: string, errorCode: string, requestId: string) {
  return buildErrorResponse(message, errorCode, requestId);
}

function getStore(routeContext: RouteContext, dependencies?: RbacDependencies) {
  return dependencies?.rbacStore ?? createPostgresAuthStore(getPool(routeContext.env));
}

async function resolvePrincipal(
  request: IncomingMessage,
  context: AuthRequestContext,
  routeContext: RouteContext,
  dependencies?: RbacDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

async function auditDeniedAccess(
  store: RbacStore,
  principal: AuthenticatedPrincipal | null,
  context: AuthRequestContext,
  action: string,
  routePath: string
) {
  await store.insertAuditLog({
    userId: principal?.user.id ?? null,
    role: principal?.user.role ?? null,
    action,
    moduleName: "rbac",
    entityType: "endpoint",
    entityId: null,
    oldValue: null,
    newValue: {
      routePath,
      denied: true,
    },
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
  });

  await store.insertSecurityEvent({
    userId: principal?.user.id ?? null,
    eventType: action,
    eventDescription: `Denied access to ${routePath}.`,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    riskLevel: "MEDIUM",
  });
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

function normalizeRole(role: string): UserRole | null {
  const candidate = role.trim().toUpperCase() as UserRole;
  return allowedRoles.has(candidate) ? candidate : null;
}

export async function handleRbacRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: RbacDependencies
) {
  const store = getStore(context, dependencies);
  const service = createRbacService(store);
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);

  if (request.method === "GET" && routePath === "/rbac/me") {
    if (!principal) {
      writeJson(response, 401, buildRbacError("Authentication is required.", "UNAUTHORIZED", context.requestId));
      return;
    }

    const payload = await service.getMe(principal);
    writeJson(response, 200, buildSuccessResponse("RBAC context retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/rbac/permissions") {
    if (!principal) {
      writeJson(response, 401, buildRbacError("Authentication is required.", "UNAUTHORIZED", context.requestId));
      return;
    }

    const payload = {
      userId: principal.user.id,
      role: principal.user.role,
      email: principal.user.email,
      sessionId: principal.session?.id ?? null,
      permissions: await service.listPermissions(),
      effectivePermissions: await service.getPrincipalPermissions(principal),
      rolePermissions: await service.listRolePermissionMappings(principal.user.role),
    };

    writeJson(response, 200, buildSuccessResponse("Permission catalogue retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/admin/rbac/permissions") {
    if (!principal) {
      writeJson(response, 401, buildRbacError("Authentication is required.", "UNAUTHORIZED", context.requestId));
      return;
    }

    const permissions = await service.getPrincipalPermissions(principal);
    if (!permissions.includes("SUPER_ADMIN_MANAGE_PERMISSIONS")) {
      await auditDeniedAccess(store, principal, requestContext, "RBAC_ADMIN_PERMISSION_VIEW_FORBIDDEN", routePath);
      writeJson(response, 403, buildRbacError("You are not allowed to view RBAC management data.", "FORBIDDEN", context.requestId));
      return;
    }

    const payload = {
      permissions: await service.getPermissionCatalog(),
      rolePermissions: await service.getRolePermissionSummary(),
    };

    writeJson(response, 200, buildSuccessResponse("RBAC management data retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/admin/rbac/role-permissions") {
    if (!principal) {
      writeJson(response, 401, buildRbacError("Authentication is required.", "UNAUTHORIZED", context.requestId));
      return;
    }

    const permissions = await service.getPrincipalPermissions(principal);
    if (!permissions.includes("SUPER_ADMIN_MANAGE_PERMISSIONS")) {
      await auditDeniedAccess(store, principal, requestContext, "RBAC_ROLE_PERMISSION_CHANGE_FORBIDDEN", routePath);
      writeJson(response, 403, buildRbacError("You are not allowed to manage RBAC permissions.", "FORBIDDEN", context.requestId));
      return;
    }

    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Partial<RolePermissionChangeInput>;
    const role = typeof body.role === "string" ? normalizeRole(body.role) : null;
    const rawPermissionKeys = Array.isArray(body.permissionKeys)
      ? body.permissionKeys
      : [];
    const permissionKeys = rawPermissionKeys.filter(
      (permission): permission is RbacPermissionKey =>
        typeof permission === "string" && RBAC_PERMISSION_KEYS.includes(permission as RbacPermissionKey)
    );
    const uniquePermissionKeys = [...new Set(permissionKeys)];

    if (!role || !uniquePermissionKeys.length || uniquePermissionKeys.length !== rawPermissionKeys.length) {
      throw new HttpError(400, "VALIDATION_ERROR", "Role and permissionKeys are required.");
    }

    const payload = await service.updateRolePermissions(principal, { role, permissionKeys: uniquePermissionKeys }, requestContext);

    writeJson(
      response,
      200,
      buildSuccessResponse("Role permissions updated.", { role, permissions: payload }, context.requestId)
    );
    return;
  }

  if (request.method === "GET" && routePath === "/customer/rbac/check") {
    if (!principal) {
      writeJson(response, 401, buildRbacError("Authentication is required.", "UNAUTHORIZED", context.requestId));
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const customerId = url.searchParams.get("customerId") ?? principal.user.id;

    try {
      await service.ensureCustomerScopeOrThrow(principal, customerId);
    } catch {
      await auditDeniedAccess(store, principal, requestContext, "CUSTOMER_SCOPE_FORBIDDEN", routePath);
      writeJson(
        response,
        403,
        buildRbacError("Customer scope is restricted to the owning account.", "FORBIDDEN", context.requestId)
      );
      return;
    }

    writeJson(
      response,
      200,
      buildSuccessResponse(
        "Customer scope verified.",
        {
          customerId,
          role: principal.user.role,
          allowed: true,
        },
        context.requestId
      )
    );
    return;
  }

  if (request.method === "GET" && routePath === "/nominee/rbac/check") {
    if (!principal) {
      writeJson(response, 401, buildRbacError("Authentication is required.", "UNAUTHORIZED", context.requestId));
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const customerId = url.searchParams.get("customerId");
    if (!customerId) {
      throw new HttpError(400, "VALIDATION_ERROR", "customerId is required.");
    }

    let assignment;
    try {
      assignment = await service.ensureNomineeAssignmentOrThrow(principal, customerId);
    } catch {
      await auditDeniedAccess(store, principal, requestContext, "NOMINEE_ASSIGNMENT_FORBIDDEN", routePath);
      writeJson(
        response,
        403,
        buildRbacError("No nominee assignment exists for the requested customer.", "FORBIDDEN", context.requestId)
      );
      return;
    }

    writeJson(
      response,
      200,
      buildSuccessResponse(
        "Nominee assignment verified.",
        {
          customerId,
          assignmentId: assignment.id,
          nomineeStatus: assignment.status,
          allowed: true,
        },
        context.requestId
      )
    );
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
