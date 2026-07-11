import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AppEnv } from "../config/env.js";
import { createOpenApiDocument } from "../config/swagger.js";
import { getHealthPayload, getReadinessPayload, getRuntimeMetadata } from "./health.js";
import { handleAuthRequest } from "../modules/auth/auth.routes.js";
import { handleAccessRuleRequest, type AccessRuleDependencies } from "../modules/access-rule/access-rule.routes.js";
import { handleObservabilityRequest, type ObservabilityDependencies } from "../modules/observability/observability.routes.js";
import { handleNomineeRequest, type NomineeDependencies } from "../modules/nominee/nominee.routes.js";
import { handleProfileRequest, type ProfileDependencies } from "../modules/profile/profile.routes.js";
import { handleReleaseRequest, type ReleaseDependencies } from "../modules/release/release.routes.js";
import { handleTriggerRequest, type TriggerDependencies } from "../modules/trigger/trigger.routes.js";
import { handleRbacRequest, type RbacDependencies } from "../modules/rbac/rbac.routes.js";
import { handleVaultRequest, type VaultDependencies } from "../modules/vault/vault.routes.js";
import {
  buildErrorResponse,
  buildSuccessResponse,
  HttpError,
  normalizePrefix,
  readJsonBody,
  readRawBody,
  writeJson,
} from "../utils/http.js";
import type { Logger } from "../config/logger.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

const backendLocalUploadRoot = path.resolve(process.cwd(), "backend", ".dev-uploads");
const devUploadBodyLimit = "100mb";

function getDevUploadRoots(env: AppEnv) {
  const roots = [
    env.DEV_LOCAL_UPLOADS_DIR ? path.resolve(env.DEV_LOCAL_UPLOADS_DIR) : backendLocalUploadRoot,
    path.resolve(process.cwd(), ".dev-uploads"),
    path.resolve(process.cwd(), "Inherix-Product", "backend", ".dev-uploads"),
  ];

  console.log("[DEBUG] getDevUploadRoots resolved to:", roots);
  return [...new Set(roots)];
}

function resolveDevUploadPath(uploadRoot: string, key: string) {
  const resolvedPath = path.resolve(uploadRoot, key);
  if (!(resolvedPath === uploadRoot || resolvedPath.startsWith(`${uploadRoot}${path.sep}`))) {
    throw new HttpError(400, "INVALID_UPLOAD_PATH", "Upload path is invalid.");
  }

  return resolvedPath;
}

export type BackendDependencies = {
  accessRule?: AccessRuleDependencies;
  nominee?: NomineeDependencies;
  profile?: ProfileDependencies;
  observability?: ObservabilityDependencies;
  release?: ReleaseDependencies;
  rbac?: RbacDependencies;
  trigger?: TriggerDependencies;
  vault?: VaultDependencies;
};

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  dependencies?: BackendDependencies
) {
  const prefix = normalizePrefix(context.env.API_PREFIX);
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = normalizePrefix(url.pathname);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (pathname === "/" || pathname === "") {
    writeJson(
      response,
      200,
      buildSuccessResponse(
        "INHERIX backend is running.",
        {
          service: "inherix-backend",
          version: "0.1.0",
          requestId: context.requestId,
        },
        context.requestId
      )
    );
    return;
  }

  if (!pathname.startsWith(prefix)) {
    throw new HttpError(404, "NOT_FOUND", "Route not found.");
  }

  const routePath = pathname.slice(prefix.length) || "/";

  if (request.method === "PUT" && routePath.startsWith("/dev/uploads/trigger-proofs/")) {
    const key = decodeURIComponent(routePath.slice("/dev/uploads/trigger-proofs/".length));
    if (!key) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const uploadRoot = getDevUploadRoots(context.env)[0];
    const resolvedPath = resolveDevUploadPath(uploadRoot, key);

    const body = await readRawBody(request, devUploadBodyLimit);
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, body);

    writeJson(
      response,
      200,
      buildSuccessResponse(
        "Development upload stored locally.",
        {
          stored: true,
          key,
          bytesWritten: body.length,
          path: resolvedPath,
        },
        context.requestId
      )
    );
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/dev/uploads/trigger-proofs/")) {
    const key = decodeURIComponent(routePath.slice("/dev/uploads/trigger-proofs/".length));
    if (!key) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const candidatePaths = getDevUploadRoots(context.env).map((uploadRoot) => resolveDevUploadPath(uploadRoot, key));
    const found = await (async () => {
      for (const candidatePath of candidatePaths) {
        const file = await readFile(candidatePath).catch(() => null);
        if (file) {
          return file;
        }
      }

      return null;
    })();
    const file = found ?? null;
    if (!file) {
      context.logger.error("UPLOAD_NOT_FOUND debug", { key, candidatePaths });
      throw new HttpError(404, "UPLOAD_NOT_FOUND", "The uploaded proof file could not be found.");
    }

    const fileName = url.searchParams.get("fileName") ?? path.basename(key);
    const extension = path.extname(fileName).toLowerCase();
    const contentType =
      extension === ".pdf"
        ? "application/pdf"
        : extension === ".png"
          ? "image/png"
          : extension === ".jpg" || extension === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";

    response.statusCode = 200;
    response.removeHeader("X-Frame-Options");
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", file.length);
    response.setHeader("Content-Disposition", `inline; filename="${fileName.replaceAll("\"", "")}"`);
    response.end(file);
    return;
  }

  if (request.method === "DELETE" && routePath.startsWith("/dev/uploads/trigger-proofs/")) {
    const key = decodeURIComponent(routePath.slice("/dev/uploads/trigger-proofs/".length));
    if (!key) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const candidatePaths = getDevUploadRoots(context.env).map((uploadRoot) => resolveDevUploadPath(uploadRoot, key));
    await Promise.all(candidatePaths.map((candidatePath) => unlink(candidatePath).catch(() => undefined)));

    writeJson(
      response,
      200,
      buildSuccessResponse(
        "Development upload deleted locally.",
        {
          deleted: true,
          key,
          path: candidatePaths[0],
        },
        context.requestId
      )
    );
    return;
  }

  if (request.method === "GET" && routePath === "/health") {
    writeJson(
      response,
      200,
      buildSuccessResponse("Backend health is healthy.", getHealthPayload(context.env), context.requestId)
    );
    return;
  }

  if (request.method === "GET" && routePath === "/ready") {
    const payload = getReadinessPayload(context.env);
    const statusCode = payload.status === "ready" ? 200 : 503;

    writeJson(
      response,
      statusCode,
      buildSuccessResponse(
        payload.status === "ready" ? "Backend is ready." : "Backend is not ready.",
        payload,
        context.requestId
      )
    );
    return;
  }

  if (request.method === "GET" && routePath === "/meta") {
    writeJson(
      response,
      200,
      buildSuccessResponse("Runtime metadata retrieved.", getRuntimeMetadata(context.env), context.requestId)
    );
    return;
  }

  if (request.method === "GET" && (routePath === "/docs" || routePath === "/openapi.json")) {
    if (!context.env.SWAGGER_ENABLED) {
      throw new HttpError(404, "DOCS_DISABLED", "OpenAPI documentation is disabled.");
    }

    writeJson(response, 200, createOpenApiDocument(context.env));
    return;
  }

  if (request.method === "POST" && routePath === "/echo") {
    const body = await readJsonBody(request, context.env.REQUEST_BODY_LIMIT);

    writeJson(
      response,
      200,
      buildSuccessResponse("Echo payload accepted.", { body, requestId: context.requestId }, context.requestId)
    );
    return;
  }

  if (routePath.startsWith("/auth/")) {
    await handleAuthRequest(request, response, context, routePath);
    return;
  }

  if (
    routePath.startsWith("/rbac/") ||
    routePath.startsWith("/admin/rbac/") ||
    routePath.startsWith("/customer/rbac/") ||
    routePath.startsWith("/nominee/rbac/")
  ) {
    await handleRbacRequest(request, response, context, routePath, dependencies?.rbac);
    return;
  }

  if (
    routePath === "/document-categories" ||
    routePath.startsWith("/vaults") ||
    routePath.startsWith("/documents")
  ) {
    await handleVaultRequest(request, response, context, routePath, dependencies?.vault);
    return;
  }

  if (routePath === "/access-rules" || routePath.startsWith("/access-rules/") || routePath === "/admin/access-rules") {
    await handleAccessRuleRequest(request, response, context, routePath, dependencies?.accessRule);
    return;
  }

  if (
    routePath === "/profile" ||
    routePath === "/profile/account" ||
    routePath === "/profile/notifications" ||
    routePath === "/profile/privacy" ||
    routePath === "/profile/privacy/export" ||
    routePath === "/profile/privacy/deletion-request" ||
    routePath === "/profile/security/change-password" ||
    routePath === "/profile/security/mfa/enable" ||
    routePath === "/profile/security/mfa/disable" ||
    routePath === "/profile/security/sessions" ||
    routePath.startsWith("/profile/security/sessions/") ||
    routePath === "/profile/security/recovery-codes/rotate" ||
    routePath.startsWith("/profile/security/trusted-devices/") ||
    routePath.startsWith("/profile/security/alerts/")
  ) {
    await handleProfileRequest(request, response, context, routePath, dependencies?.profile);
    return;
  }

  if (
    routePath === "/audit-logs" ||
    routePath === "/audit-logs/export" ||
    routePath === "/event-log" ||
    routePath === "/security/events" ||
    routePath === "/security/devices" ||
    routePath === "/security/devices/revoke" ||
    routePath === "/security/sessions" ||
    routePath === "/security-events" ||
    routePath === "/security-sessions" ||
    routePath === "/notifications" ||
    routePath.startsWith("/notifications/") ||
    routePath === "/governance" ||
    routePath === "/admin/admins" ||
    routePath.startsWith("/admin/admins/") ||
    routePath === "/admin/officers" ||
    routePath.startsWith("/admin/officers/") ||
    routePath === "/admin/dashboard" ||
    routePath === "/admin/reports" ||
    routePath === "/admin/settings" ||
    routePath === "/admin/backup"
  ) {
    await handleObservabilityRequest(request, response, context, routePath, dependencies?.observability);
    return;
  }

  if (routePath === "/releases" || routePath.startsWith("/releases/") || routePath === "/released-documents" || routePath.startsWith("/released-documents/")) {
    await handleReleaseRequest(request, response, context, routePath, dependencies?.release);
    return;
  }

  if (routePath === "/trigger-requests" || routePath.startsWith("/trigger-requests/")) {
    await handleTriggerRequest(request, response, context, routePath, dependencies?.trigger);
    return;
  }

  if (routePath === "/nominees" || routePath.startsWith("/nominees/")) {
    await handleNomineeRequest(request, response, context, routePath, dependencies?.nominee);
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}

export function createRequestId() {
  return randomUUID();
}

export function sendError(
  response: ServerResponse,
  requestId: string,
  error: HttpError
) {
  writeJson(response, error.statusCode, buildErrorResponse(error.message, error.errorCode, requestId));
}
