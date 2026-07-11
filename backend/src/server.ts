import http from "node:http";

import { createLogger, type Logger } from "./config/logger.js";
import { loadAppEnv, type AppEnv } from "./config/env.js";
import type { BackendDependencies } from "./routes/index.js";
import { createRequestListener } from "./app.js";
import { getPool } from "./db/pool.js";
import { runBackendMigrations } from "./db/migrate.js";

export function createBackendServer(env: AppEnv, logger: Logger, dependencies?: BackendDependencies) {
  const server = http.createServer(createRequestListener(env, logger, dependencies));

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;

  return server;
}

export async function startBackendServer(env: AppEnv = loadAppEnv(), dependencies?: BackendDependencies) {
  const logger = createLogger(env.LOG_LEVEL);
  if (env.DATABASE_URL) {
    await runBackendMigrations(getPool(env), logger);
  }
  const server = createBackendServer(env, logger, dependencies);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(env.PORT, resolve);
  });

  logger.info("INHERIX backend started", {
    port: env.PORT,
    environment: env.NODE_ENV,
    apiPrefix: env.API_PREFIX,
  });

  return { server, logger };
}
