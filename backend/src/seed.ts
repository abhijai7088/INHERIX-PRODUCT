import dotenv from "dotenv";
import { existsSync } from "node:fs";
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
    // Seed should see the same runtime config as the backend server.
    // Later files override earlier ones so local overrides keep working.
    dotenv.config({ path: envFile, override: true });
  }
}

async function main() {
  const env = loadAppEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run the INHERIX seed script.");
  }

  const pool = getPool(env);
  await runBackendMigrations(pool);
  const summary: Record<string, unknown> = {};

  summary.rbac = await seedRbacCatalog(pool);
  summary.vault = await seedVaultCatalog(pool);

  const seedEmail = process.env.RBAC_SEED_SUPER_ADMIN_EMAIL?.trim();
  const seedPassword = process.env.RBAC_SEED_SUPER_ADMIN_PASSWORD?.trim();

  const seedAdminEmail = process.env.RBAC_SEED_ADMIN_EMAIL?.trim();
  const seedAdminPassword = process.env.RBAC_SEED_ADMIN_PASSWORD?.trim();

  if (seedEmail && seedPassword) {
    summary.superAdmin = await seedOptionalSuperAdmin(pool, {
      email: seedEmail,
      password: seedPassword,
      fullName: process.env.RBAC_SEED_SUPER_ADMIN_FULL_NAME?.trim() || "INHERIX Super Admin",
      mobile: process.env.RBAC_SEED_SUPER_ADMIN_MOBILE?.trim() || undefined,
    });
  } else {
    summary.superAdmin = {
      skipped: true,
      reason: "Set RBAC_SEED_SUPER_ADMIN_EMAIL and RBAC_SEED_SUPER_ADMIN_PASSWORD to create a bootstrap super admin.",
    };
  }

  if (seedAdminEmail && seedAdminPassword) {
    summary.admin = await seedOptionalAdmin(pool, {
      email: seedAdminEmail,
      password: seedAdminPassword,
      fullName: process.env.RBAC_SEED_ADMIN_FULL_NAME?.trim() || "INHERIX Admin",
      mobile: process.env.RBAC_SEED_ADMIN_MOBILE?.trim() || undefined,
    });
  } else {
    summary.admin = {
      skipped: true,
      reason: "Set RBAC_SEED_ADMIN_EMAIL and RBAC_SEED_ADMIN_PASSWORD to create a bootstrap admin.",
    };
  }

  console.log(
    JSON.stringify({
      level: "info",
      message: "INHERIX RBAC seed completed",
      timestamp: new Date().toISOString(),
      summary,
    })
  );

  await pool.end();
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "INHERIX RBAC seed failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
});
