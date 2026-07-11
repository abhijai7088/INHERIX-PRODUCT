import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { AppEnv } from "./config/env.js";
import type { Logger } from "./config/logger.js";
import type { BackendDependencies } from "./routes/index.js";
import { HttpError, buildErrorResponse, readRequestOrigin, writeJson } from "./utils/http.js";
import { createRequestId, handleRequest, sendError } from "./routes/index.js";

function isAllowedOrigin(origin: string | null, env: AppEnv) {
  if (!origin) {
    return false;
  }

  const localOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);

  if (env.FRONTEND_ORIGIN && origin === env.FRONTEND_ORIGIN) {
    return true;
  }

  return localOrigins.has(origin);
}

function applySecurityHeaders(response: ServerResponse, env: AppEnv) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (env.NODE_ENV === "production") {
    response.setHeader("X-Frame-Options", "DENY");
  }
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");

  if (env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function applyCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  env: AppEnv
) {
  const origin = readRequestOrigin(request);

  if (isAllowedOrigin(origin, env) && origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Credentials", "true");
  }

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-Id, X-Requested-With, X-Api-Key"
  );
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
}

function isHttpsRequest(request: IncomingMessage) {
  const forwardedProto = request.headers["x-forwarded-proto"];

  if (Array.isArray(forwardedProto)) {
    return forwardedProto.includes("https");
  }

  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  const socket = request.socket as { encrypted?: boolean };
  return Boolean(socket.encrypted);
}

function isDatabaseConnectivityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  const message = error.message.toLowerCase();

  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "ENOTFOUND" ||
    code === "57P03" ||
    message.includes("couldn't reach") ||
    message.includes("connect timed out") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("database connection is unavailable")
  );
}

export function createRequestListener(env: AppEnv, logger: Logger, dependencies?: BackendDependencies) {
  return async function requestListener(request: IncomingMessage, response: ServerResponse) {
    const requestId = (request.headers["x-request-id"]?.toString() || createRequestId() || randomUUID()).trim();
    const startedAt = performance.now();

    response.setHeader("X-Request-Id", requestId);
    applySecurityHeaders(response, env);
    applyCorsHeaders(request, response, env);

    logger.requestStart(request, requestId);

    response.on("finish", () => {
      logger.requestEnd(request, response, requestId, performance.now() - startedAt);
    });

    if (env.NODE_ENV === "production" && !isHttpsRequest(request)) {
      sendError(response, requestId, new HttpError(400, "HTTPS_REQUIRED", "HTTPS is required in production."));
      return;
    }

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    try {
      await handleRequest(request, response, { env, logger, requestId }, dependencies);
    } catch (error) {
      if (error instanceof HttpError) {
        sendError(response, requestId, error);
        return;
      }

      if (isDatabaseConnectivityError(error)) {
        logger.error("Database connectivity error", {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });

        sendError(
          response,
          requestId,
          new HttpError(
            503,
            "DATABASE_UNAVAILABLE",
            "Database connection is unavailable. Start PostgreSQL and try again."
          )
        );
        return;
      }

      logger.error("Unhandled backend error", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      writeJson(
        response,
        500,
        buildErrorResponse(error instanceof Error ? error.message : "An unexpected backend error occurred.", "INTERNAL_ERROR", requestId)
      );
    }
  };
}
