export type PlatformMeta = {
  name: string;
  version: string;
  nodeVersion: string;
  environment: "development" | "staging" | "production" | "test";
  apiPrefix: string;
  bodyLimit: string;
  frontendOrigin: string | null;
};

export type PlatformReadiness = {
  status: "ready" | "not_ready";
  databaseConfigured: boolean;
  storageConfigured: boolean;
  signingConfigured: boolean;
  kmsConfigured: boolean;
  notificationsConfigured: boolean;
  authConfigured: boolean;
  missingProductionSecrets: string[];
};

export type PlatformSnapshot = {
  meta: PlatformMeta;
  readiness: PlatformReadiness;
};
