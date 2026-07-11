import { Pool } from "pg";

import type { AppEnv } from "../config/env.js";

let pool: Pool | null = null;

export function getPool(env: AppEnv) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database-backed auth flows.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}

