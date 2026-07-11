import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";
import {
  assertAnyPermission,
  assertPermission,
  assertRole,
} from "../dist/modules/rbac/rbac.guard.js";
import {
  RBAC_PERMISSION_CATALOG,
  RBAC_ROLE_PERMISSION_KEYS,
  listRolePermissions,
  resolveDashboardLandingPath,
} from "../dist/modules/rbac/permissions.js";
import { seedRbacCatalog } from "../dist/modules/rbac/rbac.seed.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: 0,
  API_PREFIX: "/api/v1",
  API_BASE_URL: "http://127.0.0.1:0/api/v1",
  LOG_LEVEL: "silent",
  FRONTEND_ORIGIN: "http://localhost:3000",
  SWAGGER_ENABLED: true,
  TRUST_PROXY: false,
  REQUEST_BODY_LIMIT: "1mb",
  DATABASE_URL: undefined,
  JWT_ACCESS_SECRET: undefined,
  JWT_REFRESH_SECRET: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  S3_BUCKET_NAME: undefined,
  AWS_REGION: undefined,
  AWS_KMS_KEY_ID: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createPrincipal(role, id, email, sessionId = "session-1") {
  return {
    user: {
      id,
      email,
      role,
    },
    session: {
      id: sessionId,
    },
    accessToken: "token",
    authenticatedBy: "access",
  };
}

function createMemoryRbacStore(initialRoles = {}) {
  const rolePermissions = new Map(
    Object.entries(RBAC_ROLE_PERMISSION_KEYS).map(([role, permissions]) => [role, [...permissions]])
  );
  const userRoles = new Map(Object.entries(initialRoles));
  const auditLogs = [];
  const securityEvents = [];
  const nomineeAssignments = new Map();

  const store = {
    auditLogs,
    securityEvents,
    nomineeAssignments,
    setUserRole(userId, role) {
      userRoles.set(userId, role);
    },
    setNomineeAssignment(customerId, nomineeUserId, assignment) {
      nomineeAssignments.set(`${customerId}:${nomineeUserId}`, assignment);
    },
    async listPermissions() {
      return RBAC_PERMISSION_CATALOG.map((permission, index) => ({
        id: `perm-${index + 1}`,
        permissionKey: permission.permissionKey,
        description: permission.description,
        module: permission.module,
        createdAt: "2026-06-09T00:00:00.000Z",
      }));
    },
    async findPermissionByKey(permissionKey) {
      const found = RBAC_PERMISSION_CATALOG.find((permission) => permission.permissionKey === permissionKey);
      return found
        ? {
            id: `perm-${permissionKey}`,
            permissionKey: found.permissionKey,
            description: found.description,
            module: found.module,
            createdAt: "2026-06-09T00:00:00.000Z",
          }
        : null;
    },
    async listPermissionsForRole(role) {
      return [...(rolePermissions.get(role) ?? [])];
    },
    async listPermissionsForUser(userId) {
      const role = userRoles.get(userId);
      return role ? [...(rolePermissions.get(role) ?? [])] : [];
    },
    async listRolePermissions(role) {
      const roleNames = role ? [role] : [...rolePermissions.keys()];
      return roleNames.flatMap((roleName) =>
        (rolePermissions.get(roleName) ?? []).map((permissionKey) => {
          const definition = RBAC_PERMISSION_CATALOG.find((item) => item.permissionKey === permissionKey);
          return {
            role: roleName,
            permissionId: `perm-${permissionKey}`,
            permissionKey,
            description: definition?.description ?? null,
            module: definition?.module ?? null,
            createdAt: "2026-06-09T00:00:00.000Z",
          };
        })
      );
    },
    async replaceRolePermissions(role, permissionKeys) {
      rolePermissions.set(role, [...permissionKeys]);
      return this.listRolePermissions(role);
    },
    async findNomineeAssignment(customerId, nomineeUserId) {
      return nomineeAssignments.get(`${customerId}:${nomineeUserId}`) ?? null;
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push(entry);
    },
    async countSecurityEvents() {
      return 0;
    },
    async findUserByEmail() {
      return null;
    },
    async findUserById() {
      return null;
    },
    async createUser() {
      throw new Error("not implemented");
    },
    async updateUser() {
      throw new Error("not implemented");
    },
    async touchLastLogin() {},
    async createSession() {
      throw new Error("not implemented");
    },
    async findSessionById() {
      return null;
    },
    async findSessionByRefreshTokenHash() {
      return null;
    },
    async listActiveSessions() {
      return [];
    },
    async revokeSession() {
      return null;
    },
    async revokeAllUserSessions() {
      return 0;
    },
    async rotateSession() {
      return null;
    },
    async createAuthToken() {
      throw new Error("not implemented");
    },
    async findAuthToken() {
      return null;
    },
    async consumeAuthToken() {},
  };

  return store;
}

async function withServer(dependencies, run) {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger, dependencies);

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("role permission catalog keeps the phase-3 roles distinct", () => {
  const customerPermissions = listRolePermissions("CUSTOMER");
  const nomineePermissions = listRolePermissions("NOMINEE");
  const verificationPermissions = listRolePermissions("VERIFICATION_OFFICER");
  const adminPermissions = listRolePermissions("ADMIN");
  const superAdminPermissions = listRolePermissions("SUPER_ADMIN");

  assert.ok(customerPermissions.includes("USER_MANAGE_ACCESS_RULE"));
  assert.ok(!customerPermissions.includes("ADMIN_VIEW_TRIGGER_QUEUE"));
  assert.ok(nomineePermissions.includes("NOMINEE_VIEW_RELEASED_DOCUMENT"));
  assert.ok(!nomineePermissions.includes("USER_MANAGE_ACCESS_RULE"));
  assert.ok(verificationPermissions.includes("VERIFICATION_REVIEW_PROOF"));
  assert.ok(!verificationPermissions.includes("ADMIN_RELEASE_DOCUMENT"));
  assert.ok(adminPermissions.includes("ADMIN_VIEW_TRIGGER_QUEUE"));
  assert.ok(!adminPermissions.includes("SUPER_ADMIN_MANAGE_PERMISSIONS"));
  assert.ok(superAdminPermissions.includes("SUPER_ADMIN_MANAGE_PERMISSIONS"));

  assert.equal(resolveDashboardLandingPath("CUSTOMER"), "/dashboard");
  assert.equal(resolveDashboardLandingPath("NOMINEE"), "/dashboard/released-documents");
  assert.equal(resolveDashboardLandingPath("VERIFICATION_OFFICER"), "/dashboard/verification");
  assert.equal(resolveDashboardLandingPath("ADMIN"), "/dashboard/admin");
  assert.equal(resolveDashboardLandingPath("SUPER_ADMIN"), "/dashboard/admin");
});

test("guard helpers enforce permission and role checks", () => {
  assert.equal(assertRole("ADMIN", ["ADMIN", "SUPER_ADMIN"]), undefined);

  assert.throws(() => assertPermission([], "ADMIN_VIEW_AUDIT_LOG"), (error) => {
    assert.equal(error.statusCode, 403);
    assert.equal(error.errorCode, "FORBIDDEN");
    return true;
  });

  assert.throws(() => assertAnyPermission(["ADMIN_VIEW_AUDIT_LOG"], ["SUPER_ADMIN_MANAGE_PERMISSIONS", "ADMIN_RELEASE_DOCUMENT"]), (error) => {
    assert.equal(error.statusCode, 403);
    assert.equal(error.errorCode, "FORBIDDEN");
    return true;
  });
});

test("missing token returns 401", async () => {
  const rbacStore = createMemoryRbacStore();
  await withServer(
    {
      rbac: {
        resolveAuthSnapshot: async () => null,
        rbacStore,
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/rbac/me`);
      assert.equal(response.status, 401);

      const json = await response.json();
      assert.equal(json.success, false);
      assert.equal(json.errorCode, "UNAUTHORIZED");
    }
  );
});

test("customer cannot access admin RBAC management", async () => {
  const principal = createPrincipal("CUSTOMER", "customer-1", "customer@example.com");
  const rbacStore = createMemoryRbacStore({ "customer-1": "CUSTOMER" });

  await withServer(
    {
      rbac: {
        resolveAuthSnapshot: async () => principal,
        rbacStore,
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/admin/rbac/permissions`);
      assert.equal(response.status, 403);

      const json = await response.json();
      assert.equal(json.success, false);
      assert.equal(json.errorCode, "FORBIDDEN");
      assert.equal(rbacStore.auditLogs.at(-1)?.action, "RBAC_ADMIN_PERMISSION_VIEW_FORBIDDEN");
    }
  );
});

test("nominee cannot access customer scope without assignment", async () => {
  const principal = createPrincipal("NOMINEE", "nominee-1", "nominee@example.com");
  const rbacStore = createMemoryRbacStore({ "nominee-1": "NOMINEE" });

  await withServer(
    {
      rbac: {
        resolveAuthSnapshot: async () => principal,
        rbacStore,
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/customer/rbac/check?customerId=customer-1`);
      assert.equal(response.status, 403);

      const json = await response.json();
      assert.equal(json.success, false);
      assert.equal(json.errorCode, "FORBIDDEN");
      assert.equal(rbacStore.auditLogs.at(-1)?.action, "CUSTOMER_SCOPE_FORBIDDEN");
    }
  );
});

test("admin cannot manage super admin permissions unless explicitly allowed", async () => {
  const principal = createPrincipal("ADMIN", "admin-1", "admin@example.com");
  const rbacStore = createMemoryRbacStore({ "admin-1": "ADMIN" });

  await withServer(
    {
      rbac: {
        resolveAuthSnapshot: async () => principal,
        rbacStore,
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/admin/rbac/role-permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "NOMINEE",
          permissionKeys: ["NOMINEE_RAISE_TRIGGER"],
        }),
      });

      assert.equal(response.status, 403);

      const json = await response.json();
      assert.equal(json.success, false);
      assert.equal(json.errorCode, "FORBIDDEN");
      assert.equal(rbacStore.auditLogs.at(-1)?.action, "RBAC_ROLE_PERMISSION_CHANGE_FORBIDDEN");
    }
  );
});

test("super admin can access RBAC management and update role permissions", async () => {
  const principal = createPrincipal("SUPER_ADMIN", "super-1", "super@example.com");
  const rbacStore = createMemoryRbacStore({ "super-1": "SUPER_ADMIN" });

  await withServer(
    {
      rbac: {
        resolveAuthSnapshot: async () => principal,
        rbacStore,
      },
    },
    async (baseUrl) => {
      const getResponse = await fetch(`${baseUrl}/api/v1/admin/rbac/permissions`);
      assert.equal(getResponse.status, 200);

      const getJson = await getResponse.json();
      assert.equal(getJson.success, true);
      assert.ok(Array.isArray(getJson.data.permissions));

      const postResponse = await fetch(`${baseUrl}/api/v1/admin/rbac/role-permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "NOMINEE",
          permissionKeys: ["NOMINEE_RAISE_TRIGGER", "NOMINEE_VIEW_TRIGGER_STATUS"],
        }),
      });

      assert.equal(postResponse.status, 200);

      const postJson = await postResponse.json();
      assert.equal(postJson.success, true);
      assert.deepEqual(
        postJson.data.permissions.map((entry) => entry.permissionKey),
        ["NOMINEE_RAISE_TRIGGER", "NOMINEE_VIEW_TRIGGER_STATUS"]
      );
    }
  );
});

test("permission seed creates the expected catalog and mappings", async () => {
  const queries = [];
  const fakeClient = {
    async query(sql, params = []) {
      queries.push({ sql, params });

      if (sql.includes("INSERT INTO permissions")) {
        const permissionKey = params[0];
        return {
          rows: [
            {
              id: `perm-${permissionKey}`,
              permission_key: permissionKey,
            },
          ],
        };
      }

      return { rows: [] };
    },
    release() {},
  };

  const fakePool = {
    async connect() {
      return fakeClient;
    },
  };

  const result = await seedRbacCatalog(fakePool);

  assert.equal(result.permissionsSeeded, RBAC_PERMISSION_CATALOG.length);
  assert.equal(result.roleCount, Object.keys(RBAC_ROLE_PERMISSION_KEYS).length);
  assert.ok(queries.some((entry) => entry.sql.includes("INSERT INTO role_permissions")));
});

