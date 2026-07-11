import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAppEnv } from "./config/env.js";
import { getPool } from "./db/pool.js";
import { runBackendMigrations } from "./db/migrate.js";
import { seedVaultCatalog } from "./modules/vault/vault.seed.js";
import { seedOptionalAdmin, seedOptionalSuperAdmin, seedRbacCatalog } from "./modules/rbac/rbac.seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

for (const envFile of [
  resolve(__dirname, "../../.env"),
  resolve(__dirname, "../../.env.local"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../.env.local"),
]) {
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile, override: true });
  }
}

const cleanupTables = [
  "auth_tokens",
  "user_sessions",
  "document_access_rule_history",
  "document_access_rules",
  "released_document_access_logs",
  "document_releases",
  "trigger_proofs",
  "verification_notes",
  "trigger_requests",
  "legacy_messages",
  "notifications",
  "security_events",
  "audit_logs",
  "privacy_requests",
  "profile_preferences",
  "documents",
  "nominees",
  "vaults",
  "document_categories",
  "role_permissions",
  "permissions",
] as const;

async function clearLocalUploads() {
  const uploadDirs = [
    resolve(__dirname, "../.dev-uploads"),
    resolve(__dirname, "../../backend/.dev-uploads"),
  ];

  for (const uploadDir of uploadDirs) {
    if (!existsSync(uploadDir)) {
      continue;
    }

    await rm(uploadDir, { recursive: true, force: true });
    await mkdir(uploadDir, { recursive: true });
  }
}

async function main() {
  const env = loadAppEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to reset the INHERIX database.");
  }

  const pool = getPool(env);
  await runBackendMigrations(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`TRUNCATE TABLE ${cleanupTables.join(", ")} RESTART IDENTITY CASCADE`);
    await client.query(`DELETE FROM users WHERE role NOT IN ('ADMIN', 'SUPER_ADMIN')`);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await seedRbacCatalog(pool);
  await seedVaultCatalog(pool);

  const seedAdminEmail = process.env.RBAC_SEED_ADMIN_EMAIL?.trim();
  const seedAdminPassword = process.env.RBAC_SEED_ADMIN_PASSWORD?.trim();
  if (seedAdminEmail && seedAdminPassword) {
    await seedOptionalAdmin(pool, {
      email: seedAdminEmail,
      password: seedAdminPassword,
      fullName: process.env.RBAC_SEED_ADMIN_FULL_NAME?.trim() || "INHERIX Admin",
      mobile: process.env.RBAC_SEED_ADMIN_MOBILE?.trim() || undefined,
    });
  }

  const seedSuperAdminEmail = process.env.RBAC_SEED_SUPER_ADMIN_EMAIL?.trim();
  const seedSuperAdminPassword = process.env.RBAC_SEED_SUPER_ADMIN_PASSWORD?.trim();
  if (seedSuperAdminEmail && seedSuperAdminPassword) {
    await seedOptionalSuperAdmin(pool, {
      email: seedSuperAdminEmail,
      password: seedSuperAdminPassword,
      fullName: process.env.RBAC_SEED_SUPER_ADMIN_FULL_NAME?.trim() || "INHERIX Super Admin",
      mobile: process.env.RBAC_SEED_SUPER_ADMIN_MOBILE?.trim() || undefined,
    });
  }

  await clearLocalUploads();

  const remainingUsers = await pool.query(
    `SELECT email, role
     FROM users
     ORDER BY CASE role WHEN 'SUPER_ADMIN' THEN 1 WHEN 'ADMIN' THEN 2 ELSE 3 END, email`
  );

  console.log(
    JSON.stringify({
      level: "info",
      message: "INHERIX local data reset completed",
      timestamp: new Date().toISOString(),
      summary: {
        remainingUsers: remainingUsers.rows,
        removedTables: cleanupTables,
        localUploadsCleared: true,
      },
    })
  );

  await pool.end();
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "INHERIX local data reset failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
});
