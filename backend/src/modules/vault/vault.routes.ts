import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { createAuthService } from "../auth/auth.service.js";
import type { AuthRequestContext } from "../auth/types.js";
import { getPool } from "../../db/pool.js";
import { HttpError, buildErrorResponse, buildSuccessResponse, readJsonBody, readRawBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import { createPostgresVaultStore } from "./vault.store.js";
import { createVaultService, type VaultService } from "./vault.service.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type VaultDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<{ user: { id: string; email: string; role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN" }; session: { id: string } | null; accessToken: string; authenticatedBy: "access" | "refresh" } | null>;
  vaultService?: VaultService;
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
  dependencies?: VaultDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

function getVaultService(routeContext: RouteContext, dependencies?: VaultDependencies) {
  if (dependencies?.vaultService) {
    return dependencies.vaultService;
  }

  const pool = getPool(routeContext.env);
  const store = createPostgresVaultStore(pool);
  return createVaultService(routeContext.env, routeContext.logger, {
    ...store,
    ...createPostgresAuthStore(pool),
  });
}

function parseDocumentUploadBody(body: Record<string, unknown>) {
  return {
    vaultId: typeof body.vaultId === "string" ? body.vaultId.trim() : "",
    categoryId: typeof body.categoryId === "string" ? body.categoryId.trim() : "",
    documentTitle: typeof body.documentTitle === "string" ? body.documentTitle.trim() : "",
    documentDescription: typeof body.documentDescription === "string" ? body.documentDescription.trim() : null,
    originalFileName: typeof body.originalFileName === "string" ? body.originalFileName.trim() : null,
    fileMimeType: typeof body.fileMimeType === "string" ? body.fileMimeType.trim() : null,
    fileSize: typeof body.fileSize === "number" && Number.isFinite(body.fileSize) ? body.fileSize : null,
    fileHash: typeof body.fileHash === "string" ? body.fileHash.trim() : null,
  };
}

function normalizeVaultStatus(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "LOCKED" || normalized === "NEEDS_REVIEW") {
    return normalized;
  }

  return null;
}

function normalizeDocumentStatus(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "ARCHIVED" || normalized === "DELETED") {
    return normalized;
  }

  return null;
}

export async function handleVaultRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: VaultDependencies
) {
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);
  const service = getVaultService(context, dependencies);

  if (!principal) {
    writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/document-categories") {
    const categories = await service.listDocumentCategories();
    writeJson(response, 200, buildSuccessResponse("Document categories retrieved.", { categories }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/vaults") {
    const vaults = await service.listVaults(principal);
    writeJson(response, 200, buildSuccessResponse("Vaults retrieved.", { vaults }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/vaults") {
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const vaultName = typeof body.vaultName === "string" ? body.vaultName.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;

    if (!vaultName) {
      throw new HttpError(400, "VALIDATION_ERROR", "vaultName is required.");
    }

    const vault = await service.createVault(
      principal,
      {
        customerId: principal.user.id,
        vaultName,
        description,
      },
      requestContext
    );

    writeJson(response, 201, buildSuccessResponse("Vault created.", { vault }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/vaults/")) {
    const vaultId = routePath.slice("/vaults/".length);
    if (!vaultId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const vault = await service.getVaultById(principal, vaultId);
    const documents = await service.listDocuments(principal, vaultId);

    writeJson(
      response,
      200,
      buildSuccessResponse("Vault retrieved.", { vault, documents }, context.requestId)
    );
    return;
  }

  if (request.method === "PUT" && routePath.startsWith("/vaults/")) {
    const vaultId = routePath.slice("/vaults/".length);
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const vault = await service.updateVault(
      principal,
      vaultId,
      {
        vaultName: typeof body.vaultName === "string" ? body.vaultName.trim() : null,
        description: typeof body.description === "string" ? body.description.trim() : null,
        status: normalizeVaultStatus(typeof body.status === "string" ? body.status : null),
      },
      requestContext
    );

    writeJson(response, 200, buildSuccessResponse("Vault updated.", { vault }, context.requestId));
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/vaults/")) {
    const vaultId = routePath.slice("/vaults/".length);
    const vault = await service.deleteVault(principal, vaultId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Vault deleted.", { vault }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/documents") {
    const url = new URL(request.url ?? "/", "http://localhost");
    const vaultId = url.searchParams.get("vaultId");
    const documents = await service.listDocuments(principal, vaultId);
    writeJson(response, 200, buildSuccessResponse("Documents retrieved.", { documents }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/documents/upload") {
    const body = parseDocumentUploadBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);

    if (!body.vaultId || !body.categoryId || !body.documentTitle || !body.originalFileName || !body.fileMimeType || !body.fileSize) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "vaultId, categoryId, documentTitle, originalFileName, fileMimeType, and fileSize are required."
      );
    }

    const result = await service.createDocumentUpload(
      principal,
      body,
      requestContext
    );

    writeJson(
      response,
      201,
      buildSuccessResponse("Document upload initiated.", result, context.requestId)
    );
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/documents/") && routePath.endsWith("/download")) {
    const documentId = routePath.slice("/documents/".length, -"/download".length);
    if (!documentId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const result = await service.getDocumentDownload(principal, documentId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Document download authorized.", result, context.requestId));
    return;
  }

  if (request.method === "PUT" && routePath.startsWith("/documents/") && routePath.endsWith("/content")) {
    const documentId = routePath.slice("/documents/".length, -"/content".length);
    if (!documentId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const content = await readRawBody(request, context.env.REQUEST_BODY_LIMIT);
    const result = await service.uploadDocumentContent(principal, documentId, content, requestContext);

    writeJson(
      response,
      200,
      buildSuccessResponse("Document content uploaded.", result, context.requestId)
    );
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/documents/")) {
    const documentId = routePath.slice("/documents/".length);
    if (!documentId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const document = await service.getDocument(principal, documentId);
    writeJson(response, 200, buildSuccessResponse("Document retrieved.", { document }, context.requestId));
    return;
  }

  if (request.method === "PUT" && routePath.startsWith("/documents/")) {
    const documentId = routePath.slice("/documents/".length);
    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const document = await service.updateDocument(
      principal,
      documentId,
      {
        documentTitle: typeof body.documentTitle === "string" ? body.documentTitle.trim() : null,
        documentDescription: typeof body.documentDescription === "string" ? body.documentDescription.trim() : null,
        categoryId: typeof body.categoryId === "string" ? body.categoryId.trim() : null,
        status: normalizeDocumentStatus(typeof body.status === "string" ? body.status : null),
      },
      requestContext
    );

    writeJson(response, 200, buildSuccessResponse("Document updated.", { document }, context.requestId));
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/documents/")) {
    const documentId = routePath.slice("/documents/".length);
    const document = await service.deleteDocument(principal, documentId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Document deleted.", { document }, context.requestId));
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
