import type { Pool } from "pg";

import { hashPassword } from "../../lib/password.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { UserRole } from "../auth/types.js";
import { RBAC_PERMISSION_CATALOG, RBAC_ROLE_PERMISSION_KEYS, type RbacPermissionKey } from "./permissions.js";

export async function seedRbacCatalog(pool: Pool) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const permissionIdByKey = new Map<string, string>();

    for (const permission of RBAC_PERMISSION_CATALOG) {
      const result = await client.query(
        `INSERT INTO permissions (permission_key, description, module)
         VALUES ($1, $2, $3)
         ON CONFLICT (permission_key) DO UPDATE
         SET description = EXCLUDED.description,
             module = EXCLUDED.module
         RETURNING id, permission_key`,
        [permission.permissionKey, permission.description, permission.module]
      );

      const row = result.rows[0] as Record<string, unknown>;
      permissionIdByKey.set(String(row.permission_key), String(row.id));
    }

    for (const [role, permissionKeys] of Object.entries(RBAC_ROLE_PERMISSION_KEYS) as [UserRole, RbacPermissionKey[]][]) {
      await client.query("DELETE FROM role_permissions WHERE role = $1::user_role", [role]);

      for (const permissionKey of permissionKeys) {
        const permissionId = permissionIdByKey.get(permissionKey);
        if (!permissionId) {
          continue;
        }

        await client.query(
          `INSERT INTO role_permissions (role, permission_id)
           VALUES ($1::user_role, $2::uuid)
           ON CONFLICT (role, permission_id) DO NOTHING`,
          [role, permissionId]
        );
      }
    }

    await client.query("COMMIT");

    return {
      permissionsSeeded: RBAC_PERMISSION_CATALOG.length,
      roleCount: Object.keys(RBAC_ROLE_PERMISSION_KEYS).length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type SeedSuperAdminInput = {
  email: string;
  password: string;
  fullName?: string;
  mobile?: string;
};

export type SeedAdminInput = {
  email: string;
  password: string;
  fullName?: string;
  mobile?: string;
};

async function seedBootstrapUser(
  pool: Pool,
  input: SeedAdminInput,
  role: "ADMIN" | "SUPER_ADMIN",
  defaultFullName: string
) {
  const store = createPostgresAuthStore(pool);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const fullName = input.fullName?.trim() || defaultFullName;
  const mobile = input.mobile?.trim() || null;

  const existing = await store.findUserByEmail(email);
  if (existing) {
    const updated = await store.updateUser(existing.id, {
      fullName,
      mobile,
      passwordHash,
      role,
      status: "ACTIVE",
      isEmailVerified: true,
      isMobileVerified: Boolean(mobile),
    });

    if (!updated) {
      throw new Error(`Unable to update the seeded ${role.toLowerCase()} account.`);
    }

    return {
      userId: updated.id,
      email: updated.email,
      role: updated.role,
      created: false,
    };
  }

  const created = await store.createUser({
    fullName,
    email,
    mobile,
    passwordHash,
    role,
    status: "ACTIVE",
    isEmailVerified: true,
    isMobileVerified: Boolean(mobile),
  });

  return {
    userId: created.id,
    email: created.email,
    role: created.role,
    created: true,
  };
}

export async function seedOptionalSuperAdmin(pool: Pool, input: SeedSuperAdminInput) {
  return seedBootstrapUser(pool, input, "SUPER_ADMIN", "INHERIX Super Admin");
}

export async function seedOptionalAdmin(pool: Pool, input: SeedAdminInput) {
  return seedBootstrapUser(pool, input, "ADMIN", "INHERIX Admin");
}
