import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { createAuthService } from "../auth/auth.service.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext } from "../auth/types.js";
import { getPool } from "../../db/pool.js";
import { HttpError, buildErrorResponse, buildSuccessResponse, readJsonBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createAccessRuleService, type AccessRuleService } from "./access-rule.service.js";
import { createPostgresAccessRuleStore } from "./access-rule.store.js";
import { createPostgresNomineeStore } from "../nominee/nominee.store.js";
import { createPostgresVaultStore } from "../vault/vault.store.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type AccessRuleDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<{
    user: { id: string; email: string; role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN" };
    session: { id: string } | null;
    accessToken: string;
    authenticatedBy: "access" | "refresh";
  } | null>;
  accessRuleService?: AccessRuleService;
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
  dependencies?: AccessRuleDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

function getAccessRuleService(routeContext: RouteContext, dependencies?: AccessRuleDependencies) {
  if (dependencies?.accessRuleService) {
    return dependencies.accessRuleService;
  }

  const pool = getPool(routeContext.env);
  const store = createPostgresAccessRuleStore(pool);
  const nomineeStore = createPostgresNomineeStore(pool);
  const vaultStore = createPostgresVaultStore(pool);
  const authStore = createPostgresAuthStore(pool);

  return createAccessRuleService(routeContext.env, routeContext.logger, {
    ...store,
    ...nomineeStore,
    ...vaultStore,
    ...authStore,
  });
}

function parseRuleBody(body: Record<string, unknown>) {
  return {
    nomineeId: typeof body.nomineeId === "string" ? body.nomineeId.trim() : "",
    documentId: typeof body.documentId === "string" ? body.documentId.trim() : null,
    categoryId: typeof body.categoryId === "string" ? body.categoryId.trim() : null,
    canView: typeof body.canView === "boolean" ? body.canView : false,
    canDownload: typeof body.canDownload === "boolean" ? body.canDownload : false,
    releaseCondition: typeof body.releaseCondition === "string" ? body.releaseCondition.trim().toUpperCase() : "",
    conditionNotes: typeof body.conditionNotes === "string" ? body.conditionNotes.trim() : null,
  };
}

function parseRuleUpdateBody(body: Record<string, unknown>) {
  function normalizeString(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  return {
    nomineeId: normalizeString(body.nomineeId),
    documentId: normalizeString(body.documentId),
    categoryId: normalizeString(body.categoryId),
    canView: typeof body.canView === "boolean" ? body.canView : null,
    canDownload: typeof body.canDownload === "boolean" ? body.canDownload : null,
    releaseCondition: normalizeString(body.releaseCondition)?.toUpperCase() ?? null,
    conditionNotes: normalizeString(body.conditionNotes),
  };
}

function isReleaseCondition(value: string) {
  return [
    "DEATH_EVENT",
    "MEDICAL_INCAPACITY",
    "LEGAL_EVENT",
    "EMERGENCY_ACCESS",
    "OWNER_INACTIVE",
    "OTHER",
  ].includes(value);
}

export async function handleAccessRuleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: AccessRuleDependencies
) {
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);
  const service = getAccessRuleService(context, dependencies);
  const url = new URL(request.url ?? "/", "http://localhost");

  if (!principal) {
    writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/access-rules") {
    const rules = await service.listAccessRules(principal, {
      nomineeId: url.searchParams.get("nomineeId"),
      documentId: url.searchParams.get("documentId"),
      categoryId: url.searchParams.get("categoryId"),
      status: url.searchParams.get("status") as "ACTIVE" | "REVOKED" | "DELETED" | null,
    });

    writeJson(response, 200, buildSuccessResponse("Access rules retrieved.", { rules }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/admin/access-rules") {
    const rules = await service.listAdminAccessRules(principal, {
      nomineeId: url.searchParams.get("nomineeId"),
      documentId: url.searchParams.get("documentId"),
      categoryId: url.searchParams.get("categoryId"),
      status: url.searchParams.get("status") as "ACTIVE" | "REVOKED" | "DELETED" | null,
    });

    writeJson(response, 200, buildSuccessResponse("Access rules retrieved.", { rules }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/access-rules") {
    const body = parseRuleBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);

    if (!body.nomineeId || !isReleaseCondition(body.releaseCondition)) {
      throw new HttpError(400, "VALIDATION_ERROR", "nomineeId and releaseCondition are required.");
    }

    const rule = await service.createAccessRule(
      principal,
      {
        nomineeId: body.nomineeId,
        documentId: body.documentId,
        categoryId: body.categoryId,
        canView: body.canView,
        canDownload: body.canDownload,
        releaseCondition: body.releaseCondition as
          | "DEATH_EVENT"
          | "MEDICAL_INCAPACITY"
          | "LEGAL_EVENT"
          | "EMERGENCY_ACCESS"
          | "OWNER_INACTIVE"
          | "OTHER",
        conditionNotes: body.conditionNotes,
      },
      {
        ipAddress: requestContext.ipAddress,
        deviceInfo: requestContext.deviceInfo,
      }
    );

    writeJson(response, 201, buildSuccessResponse("Access rule created.", { rule }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/access-rules/")) {
    const ruleId = routePath.slice("/access-rules/".length);
    if (!ruleId || ruleId.includes("/")) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const payload = await service.getAccessRule(principal, ruleId);
    writeJson(response, 200, buildSuccessResponse("Access rule retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "PUT" && routePath.startsWith("/access-rules/")) {
    const ruleId = routePath.slice("/access-rules/".length);
    if (!ruleId || ruleId.includes("/")) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseRuleUpdateBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    if (body.releaseCondition && !isReleaseCondition(body.releaseCondition)) {
      throw new HttpError(400, "VALIDATION_ERROR", "releaseCondition is invalid.");
    }

    const rule = await service.updateAccessRule(
      principal,
      ruleId,
      {
        nomineeId: body.nomineeId,
        documentId: body.documentId,
        categoryId: body.categoryId,
        canView: body.canView,
        canDownload: body.canDownload,
        releaseCondition: body.releaseCondition as
          | "DEATH_EVENT"
          | "MEDICAL_INCAPACITY"
          | "LEGAL_EVENT"
          | "EMERGENCY_ACCESS"
          | "OWNER_INACTIVE"
          | "OTHER"
          | null,
        conditionNotes: body.conditionNotes,
      },
      {
        ipAddress: requestContext.ipAddress,
        deviceInfo: requestContext.deviceInfo,
      }
    );

    writeJson(response, 200, buildSuccessResponse("Access rule updated.", { rule }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.endsWith("/revoke") && routePath.startsWith("/access-rules/")) {
    const ruleId = routePath.slice("/access-rules/".length, -"/revoke".length);
    if (!ruleId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const rule = await service.revokeAccessRule(principal, ruleId, {
      ipAddress: requestContext.ipAddress,
      deviceInfo: requestContext.deviceInfo,
    });
    writeJson(response, 200, buildSuccessResponse("Access rule revoked.", { rule }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.endsWith("/reactivate") && routePath.startsWith("/access-rules/")) {
    const ruleId = routePath.slice("/access-rules/".length, -"/reactivate".length);
    if (!ruleId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const rule = await service.reactivateAccessRule(principal, ruleId, {
      ipAddress: requestContext.ipAddress,
      deviceInfo: requestContext.deviceInfo,
    });
    writeJson(response, 200, buildSuccessResponse("Access rule reactivated.", { rule }, context.requestId));
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/access-rules/")) {
    const ruleId = routePath.slice("/access-rules/".length);
    if (!ruleId || ruleId.includes("/")) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const rule = await service.deleteAccessRule(principal, ruleId, {
      ipAddress: requestContext.ipAddress,
      deviceInfo: requestContext.deviceInfo,
    });
    writeJson(response, 200, buildSuccessResponse("Access rule deleted.", { rule }, context.requestId));
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
