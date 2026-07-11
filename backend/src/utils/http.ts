import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(limit: string) {
    super(413, "PAYLOAD_TOO_LARGE", `Request body exceeds the configured limit of ${limit}.`);
    this.name = "PayloadTooLargeError";
  }
}

export function createTimestamp() {
  return new Date().toISOString();
}

export function normalizePrefix(prefix: string) {
  if (!prefix.startsWith("/")) {
    return `/${prefix}`;
  }

  return prefix === "/" ? "/" : prefix.replace(/\/+$/, "");
}

export function parseSizeLimit(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)(b|kb|mb|gb)?$/);

  if (!match) {
    return 1_048_576;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "b";
  const multiplier =
    unit === "gb"
      ? 1024 * 1024 * 1024
      : unit === "mb"
        ? 1024 * 1024
        : unit === "kb"
          ? 1024
          : 1;

  return amount * multiplier;
}

export function readRequestOrigin(request: IncomingMessage) {
  const origin = request.headers.origin;

  if (Array.isArray(origin)) {
    return origin[0] ?? null;
  }

  return origin ?? null;
}

export async function readJsonBody(request: IncomingMessage, limit: string) {
  const maxBytes = parseSizeLimit(limit);
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;

    if (total > maxBytes) {
      throw new PayloadTooLargeError(limit);
    }

    chunks.push(buffer);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

export async function readRawBody(request: IncomingMessage, limit: string) {
  const maxBytes = parseSizeLimit(limit);
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;

    if (total > maxBytes) {
      throw new PayloadTooLargeError(limit);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  headers: Record<string, string> = {}
) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }

  response.end(JSON.stringify(payload));
}

export function buildSuccessResponse<T>(message: string, data: T, requestId: string) {
  return {
    success: true,
    message,
    data,
    timestamp: createTimestamp(),
    requestId,
  };
}

export function buildErrorResponse(
  message: string,
  errorCode: string,
  requestId: string
) {
  return {
    success: false,
    message,
    errorCode,
    timestamp: createTimestamp(),
    requestId,
  };
}
