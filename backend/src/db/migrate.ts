import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

import type { Logger } from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = resolve(__dirname, "../../migrations");
const migrationTable = "schema_migrations";

let migrationsRan = false;

export async function runBackendMigrations(pool: Pool, logger?: Logger) {
  if (migrationsRan) {
    return;
  }

  const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const client = await pool.connect();

  try {
    await client.query(`CREATE TABLE IF NOT EXISTS ${migrationTable} (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    const appliedResult = await client.query<{ filename: string }>(
      `SELECT filename FROM ${migrationTable} ORDER BY filename ASC`
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        logger?.debug?.("Skipping already applied backend migration", { file });
        continue;
      }

      const sql = await readFile(resolve(migrationsDir, file), "utf8");
      logger?.info("Applying backend migration", { file });
      await client.query(sql);
      await client.query(`INSERT INTO ${migrationTable} (filename) VALUES ($1)`, [file]);
    }

    migrationsRan = true;
  } finally {
    client.release();
  }
}
