import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { createAuthService } from "../auth/auth.service.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext } from "../auth/types.js";
import { createPostgresAccessRuleStore } from "../access-rule/access-rule.store.js";
import { getPool } from "../../db/pool.js";
import { HttpError, buildErrorResponse, buildSuccessResponse, readJsonBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createEmailService } from "../email/email.service.js";
import { createNomineeService, type NomineeService } from "./nominee.service.js";
import { createPostgresNomineeStore } from "./nominee.store.js";
import { createPostgresVaultStore } from "../vault/vault.store.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type NomineeDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<{
    user: { id: string; email: string; role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN"; fullName?: string };
    session: { id: string } | null;
    accessToken: string;
    authenticatedBy: "access" | "refresh";
  } | null>;
  nomineeService?: NomineeService;
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
  dependencies?: NomineeDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

function getNomineeService(routeContext: RouteContext, dependencies?: NomineeDependencies) {
  if (dependencies?.nomineeService) {
    return dependencies.nomineeService;
  }

  const pool = getPool(routeContext.env);
  const store = createPostgresNomineeStore(pool);
  const authStore = createPostgresAuthStore(pool);
  const accessRuleStore = createPostgresAccessRuleStore(pool);
  const vaultStore = createPostgresVaultStore(pool);
  return createNomineeService(
    routeContext.env,
    routeContext.logger,
    store,
    authStore,
    accessRuleStore,
    vaultStore,
    createEmailService(routeContext.env, routeContext.logger)
  );
}

function parseNomineeBody(body: Record<string, unknown>) {
  return {
    fullName: typeof body.fullName === "string" ? body.fullName.trim() : "",
    email: typeof body.email === "string" ? body.email.trim() : "",
    mobile: typeof body.mobile === "string" ? body.mobile.trim() : "",
    relationship: typeof body.relationship === "string" ? body.relationship.trim() : "",
    customRelationship: typeof body.customRelationship === "string" ? body.customRelationship.trim() : null,
    notes: typeof body.notes === "string" ? body.notes.trim() : null,
  };
}

function parseNomineeUpdateBody(body: Record<string, unknown>) {
  return {
    fullName: typeof body.fullName === "string" ? body.fullName.trim() : null,
    email: typeof body.email === "string" ? body.email.trim() : null,
    mobile: typeof body.mobile === "string" ? body.mobile.trim() : null,
    relationship: typeof body.relationship === "string" ? body.relationship.trim() : null,
    customRelationship: typeof body.customRelationship === "string" ? body.customRelationship.trim() : null,
    notes: typeof body.notes === "string" ? body.notes.trim() : null,
  };
}

export async function handleNomineeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: NomineeDependencies
) {
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);
  const service = getNomineeService(context, dependencies);

  if (request.method === "GET" && routePath === "/nominees/invitation-context") {
    const url = new URL(request.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    const invitation = await service.getInvitationContext(token);
    writeJson(response, 200, buildSuccessResponse("Invitation context retrieved.", { invitation }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/nominees/invitation-context/resend") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    const resend = await service.resendExpiredInvitationByToken(token, requestContext);
    writeJson(response, 200, buildSuccessResponse("Invitation resent.", { resend }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/nominees/accept-invitation") {
    if (!principal) {
      writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
      return;
    }

    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    const result = await service.acceptInvitation(principal, { token }, requestContext);
    writeJson(response, 200, buildSuccessResponse("Invitation accepted.", result, context.requestId));
    return;
  }

  if (!principal) {
    writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/nominees/me/all") {
    const nominees = await service.getAllNominees(principal);
    writeJson(response, 200, buildSuccessResponse("All nominee records retrieved.", { nominees }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/nominees/me") {
    const nominee = await service.getCurrentNominee(principal);
    writeJson(response, 200, buildSuccessResponse("Nominee retrieved.", { nominee }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/nominees") {
    const nominees = await service.listNominees(principal);
    writeJson(response, 200, buildSuccessResponse("Nominees retrieved.", { nominees }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/nominees") {
    const body = parseNomineeBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    const nominee = await service.createNominee(principal, body, requestContext);
    writeJson(response, 201, buildSuccessResponse("Nominee invited.", { nominee }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/nominees/")) {
    const nomineeId = routePath.slice("/nominees/".length);
    if (!nomineeId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    if (nomineeId === "accept-invitation") {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const nominee = await service.getNominee(principal, nomineeId);
    writeJson(response, 200, buildSuccessResponse("Nominee retrieved.", { nominee }, context.requestId));
    return;
  }

  if (request.method === "PUT" && routePath.startsWith("/nominees/")) {
    const nomineeId = routePath.slice("/nominees/".length);
    if (!nomineeId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseNomineeUpdateBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    const nominee = await service.updateNominee(principal, nomineeId, body, requestContext);
    writeJson(response, 200, buildSuccessResponse("Nominee updated.", { nominee }, context.requestId));
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/nominees/")) {
    const nomineeId = routePath.slice("/nominees/".length);
    if (!nomineeId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const nominee = await service.removeNominee(principal, nomineeId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Nominee removed.", { nominee }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/nominees/") && routePath.endsWith("/resend-invite")) {
    const nomineeId = routePath.slice("/nominees/".length, -"/resend-invite".length);
    const nominee = await service.resendInvitation(principal, nomineeId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Invitation resent.", { nominee }, context.requestId));
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
