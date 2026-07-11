import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { getPool } from "../../db/pool.js";
import { createAuthService } from "../auth/auth.service.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext } from "../auth/types.js";
import { HttpError, buildErrorResponse, buildSuccessResponse, readJsonBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createReleaseService, type ReleaseService } from "./release.service.js";
import { createPostgresReleaseStore } from "./release.store.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type ReleaseDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<{
    user: { id: string; email: string; role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN"; fullName?: string };
    session: { id: string } | null;
    accessToken: string;
    authenticatedBy: "access" | "refresh";
  } | null>;
  releaseService?: ReleaseService;
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
  dependencies?: ReleaseDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

function getReleaseService(routeContext: RouteContext, dependencies?: ReleaseDependencies) {
  if (dependencies?.releaseService) {
    return dependencies.releaseService;
  }

  const pool = getPool(routeContext.env);
  const store = createPostgresReleaseStore(pool);
  const authStore = createPostgresAuthStore(pool);
  return createReleaseService(routeContext.env, routeContext.logger, {
    ...store,
    ...authStore,
  });
}

function parseReleaseBody(body: Record<string, unknown>) {
  return {
    triggerRequestId: typeof body.triggerRequestId === "string" ? body.triggerRequestId.trim() : "",
    documentId: typeof body.documentId === "string" ? body.documentId.trim() : "",
    canView: typeof body.canView === "boolean" ? body.canView : true,
    canDownload: typeof body.canDownload === "boolean" ? body.canDownload : false,
    releaseNotes: typeof body.releaseNotes === "string" ? body.releaseNotes.trim() : null,
    notes: typeof body.notes === "string" ? body.notes.trim() : null,
    action: body.action === "view" || body.action === "download" ? body.action : "",
  };
}

export async function handleReleaseRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: ReleaseDependencies
) {
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);
  const service = getReleaseService(context, dependencies);

  if (!principal) {
    writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
    return;
  }

  context.logger.debug("Release route called", {
    method: request.method,
    routePath,
    userId: principal.user.id,
    role: principal.user.role,
  });

  if (request.method === "GET" && routePath === "/releases") {
    const payload = await service.listReleaseQueue(principal);
    writeJson(response, 200, buildSuccessResponse("Release queue retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/releases/") && routePath.length > "/releases/".length) {
    const requestId = routePath.slice("/releases/".length);
    if (!requestId || requestId.includes("/")) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const payload = await service.getReleaseQueueRequest(principal, requestId);
    writeJson(response, 200, buildSuccessResponse("Release case retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/releases") {
    const body = parseReleaseBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    if (!body.triggerRequestId || !body.documentId) {
      throw new HttpError(400, "VALIDATION_ERROR", "triggerRequestId and documentId are required.");
    }

    const payload = await service.createOrUpdateRelease(
      principal,
      {
        triggerRequestId: body.triggerRequestId,
        documentId: body.documentId,
        canView: body.canView,
        canDownload: body.canDownload,
        releaseNotes: body.releaseNotes,
      },
      requestContext
    );

    writeJson(response, 201, buildSuccessResponse("Document release configured.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/releases/") && routePath.endsWith("/revoke")) {
    const releaseId = routePath.slice("/releases/".length, -"/revoke".length);
    if (!releaseId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseReleaseBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    const payload = await service.revokeRelease(principal, releaseId, body.notes, requestContext);
    writeJson(response, 200, buildSuccessResponse("Document release revoked.", payload, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/released-documents") {
    context.logger.debug("Nominee released documents requested", {
      userId: principal.user.id,
      role: principal.user.role,
    });
    const payload = await service.listReleasedDocuments(principal);
    writeJson(response, 200, buildSuccessResponse("Released documents retrieved.", payload, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/released-documents/") && routePath.endsWith("/access")) {
    const releaseId = routePath.slice("/released-documents/".length, -"/access".length);
    if (!releaseId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }
    const rawBody = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    context.logger.debug("Nominee release access request received", {
      userId: principal.user.id,
      role: principal.user.role,
      releaseId,
      body: rawBody,
    });

    const body = parseReleaseBody(rawBody);
    if (!body.action) {
      throw new HttpError(400, "VALIDATION_ERROR", "action is required.");
    }

    const payload = await service.requestReleasedDocumentAccess(principal, releaseId, body.action as "view" | "download", requestContext);
    writeJson(response, 200, buildSuccessResponse("Released document access granted.", payload, context.requestId));
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
