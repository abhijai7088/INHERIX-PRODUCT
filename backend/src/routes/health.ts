import type { AppEnv } from "../config/env.js";
import { getMissingProductionSecrets, hasEmailDeliveryConfig } from "../config/env.js";

export function getHealthPayload(env: AppEnv) {
  return {
    status: "ok" as const,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage().rss,
    apiPrefix: env.API_PREFIX,
    version: "0.1.0",
  };
}

export function getReadinessPayload(env: AppEnv) {
  const missingProductionSecrets = env.NODE_ENV === "production" ? getMissingProductionSecrets(env) : [];

  return {
    status: missingProductionSecrets.length ? "not_ready" : "ready",
    databaseConfigured: Boolean(env.DATABASE_URL),
    storageConfigured: Boolean(env.S3_BUCKET_NAME),
    signingConfigured: Boolean(env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET),
    kmsConfigured: Boolean(env.AWS_KMS_KEY_ID),
    notificationsConfigured: hasEmailDeliveryConfig(env),
    authConfigured: Boolean(env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET),
    missingProductionSecrets,
  };
}

export function getRuntimeMetadata(env: AppEnv) {
  return {
    name: "INHERIX Backend",
    version: "0.1.0",
    nodeVersion: process.version,
    environment: env.NODE_ENV,
    apiPrefix: env.API_PREFIX,
    bodyLimit: env.REQUEST_BODY_LIMIT,
    frontendOrigin: env.FRONTEND_ORIGIN ?? null,
  };
}
