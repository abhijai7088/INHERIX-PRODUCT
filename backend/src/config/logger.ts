import type { IncomingMessage, ServerResponse } from "node:http";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const levelRank: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const sensitiveKeys = new Set([
  "authorization",
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "secret",
  "jwt",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "kms_key",
  "kmskey",
  "documentcontent",
  "content",
]);

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(level: LogLevel = "info") {
  const shouldLog = (target: Exclude<LogLevel, "silent">) => levelRank[level] >= levelRank[target];

  function emit(targetLevel: Exclude<LogLevel, "silent">, message: string, context?: Record<string, unknown>) {
    if (!shouldLog(targetLevel)) {
      return;
    }

    const entry = {
      level: targetLevel,
      message,
      timestamp: new Date().toISOString(),
      ...(context ? redact(context) : {}),
    };

    const line = JSON.stringify(entry);

    if (targetLevel === "error") {
      console.error(line);
      return;
    }

    if (targetLevel === "warn") {
      console.warn(line);
      return;
    }

    console.log(line);
  }

  return {
    debug(message: string, context?: Record<string, unknown>) {
      emit("debug", message, context);
    },
    info(message: string, context?: Record<string, unknown>) {
      emit("info", message, context);
    },
    warn(message: string, context?: Record<string, unknown>) {
      emit("warn", message, context);
    },
    error(message: string, context?: Record<string, unknown>) {
      emit("error", message, context);
    },
    requestStart(request: IncomingMessage, requestId: string) {
      emit("info", "Request started", {
        requestId,
        method: request.method,
        path: request.url,
      });
    },
    requestEnd(
      request: IncomingMessage,
      response: ServerResponse,
      requestId: string,
      durationMs: number
    ) {
      emit("info", "Request completed", {
        requestId,
        method: request.method,
        path: request.url,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      });
    },
  };
}

export function redact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(input)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
      continue;
    }

    output[key] = redact(item);
  }

  return output as T;
}

