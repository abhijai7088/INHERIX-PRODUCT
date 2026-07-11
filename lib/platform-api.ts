import { backendJsonFetch } from "@/lib/auth-state";
import { parseBackendJsonResponse } from "@/lib/backend-api";

export type {
  PlatformMeta,
  PlatformReadiness,
  PlatformSnapshot,
} from "@/types/platform";

import type {
  PlatformMeta,
  PlatformReadiness,
  PlatformSnapshot,
} from "@/types/platform";

function readPlatform<T>(response: Response, fallbackMessage: string) {
  return parseBackendJsonResponse<T>(response, fallbackMessage);
}

export async function getPlatformMeta() {
  const response = await backendJsonFetch("/meta");
  return readPlatform<{ name: string; version: string; nodeVersion: string; environment: string; apiPrefix: string; bodyLimit: string; frontendOrigin: string | null }>(
    response,
    "Unable to load platform metadata."
  );
}

export async function getPlatformReadiness() {
  const response = await backendJsonFetch("/ready");
  return readPlatform<{
    status: "ready" | "not_ready";
    databaseConfigured: boolean;
    storageConfigured: boolean;
    signingConfigured: boolean;
    kmsConfigured: boolean;
    notificationsConfigured: boolean;
    authConfigured: boolean;
    missingProductionSecrets: string[];
  }>(response, "Unable to load platform readiness.");
}

export async function getPlatformSnapshot(): Promise<PlatformSnapshot> {
  const [meta, readiness] = await Promise.all([getPlatformMeta(), getPlatformReadiness()]);

  return {
    meta: meta as PlatformMeta,
    readiness: readiness as PlatformReadiness,
  };
}
