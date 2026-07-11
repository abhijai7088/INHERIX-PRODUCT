import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";
import { createAccessRuleService } from "../dist/modules/access-rule/access-rule.service.js";

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
  JWT_ACCESS_SECRET: "test-access-secret",
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
  AWS_ACCESS_KEY_ID: undefined,
  AWS_SECRET_ACCESS_KEY: undefined,
  AWS_SESSION_TOKEN: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createCustomerPrincipal() {
  return {
    user: {
      id: "customer-1",
      email: "customer@example.com",
      role: "CUSTOMER",
    },
    session: {
      id: "session-1",
    },
    accessToken: "customer-access",
    authenticatedBy: "access",
  };
}

function createAdminPrincipal() {
  return {
    user: {
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
    },
    session: {
      id: "session-admin",
    },
    accessToken: "admin-access",
    authenticatedBy: "access",
  };
}

function now() {
  return new Date().toISOString();
}

function createAccessRuleTestStore() {
  const nominees = [
    {
      id: "nominee-1",
      customerId: "customer-1",
      fullName: "Nominee One",
      email: "nominee@example.com",
      status: "ACTIVE",
    },
    {
      id: "nominee-2",
      customerId: "customer-2",
      fullName: "Other Nominee",
      email: "other@example.com",
      status: "ACTIVE",
    },
  ];

  const categories = [
    { id: "category-1", categoryName: "Legal Documents", isActive: true },
    { id: "category-2", categoryName: "Emergency Documents", isActive: true },
  ];

  const documents = [
    {
      id: "document-1",
      customerId: "customer-1",
      documentTitle: "Will",
      categoryId: "category-1",
    },
    {
      id: "document-2",
      customerId: "customer-2",
      documentTitle: "Other Customer Doc",
      categoryId: "category-1",
    },
  ];

  const rules = [];
  const history = [];
  const auditLogs = [];
  const securityEvents = [];

  function hydrateRule(rule) {
    const nominee = nominees.find((item) => item.id === rule.nomineeId);
    const document = rule.documentId ? documents.find((item) => item.id === rule.documentId) : null;
    const category = rule.categoryId ? categories.find((item) => item.id === rule.categoryId) : null;

    return {
      ...rule,
      scopeType: rule.documentId ? "DOCUMENT" : "CATEGORY",
      nomineeFullName: nominee?.fullName ?? "Unknown nominee",
      nomineeEmail: nominee?.email ?? null,
      documentTitle: document?.documentTitle ?? null,
      categoryName: category?.categoryName ?? null,
      isActive: rule.isActive && !rule.deletedAt,
      status: rule.deletedAt ? "DELETED" : rule.isActive ? "ACTIVE" : "REVOKED",
    };
  }

  const store = {
    rules,
    history,
    auditLogs,
    securityEvents,
    async listRules(customerId, filters) {
      return rules
        .map((rule) => hydrateRule(rule))
        .filter((rule) => (customerId ? rule.customerId === customerId : true))
        .filter((rule) => (filters?.nomineeId ? rule.nomineeId === filters.nomineeId : true))
        .filter((rule) => (filters?.documentId ? rule.documentId === filters.documentId : true))
        .filter((rule) => (filters?.categoryId ? rule.categoryId === filters.categoryId : true))
        .filter((rule) => (filters?.status ? rule.status === filters.status : true));
    },
    async findRuleById(ruleId) {
      const rule = rules.find((item) => item.id === ruleId);
      return rule ? hydrateRule(rule) : null;
    },
    async findRuleByScope(customerId, nomineeId, documentId, categoryId, excludeRuleId) {
      const rule = rules.find(
        (item) =>
          item.customerId === customerId &&
          item.nomineeId === nomineeId &&
          item.documentId === documentId &&
          item.categoryId === categoryId &&
          item.id !== excludeRuleId
      );

      return rule ? hydrateRule(rule) : null;
    },
    async createRule(input) {
      const rule = {
        id: `rule-${rules.length + 1}`,
        customerId: input.customerId,
        nomineeId: input.nomineeId,
        documentId: input.documentId ?? null,
        categoryId: input.categoryId ?? null,
        canView: input.canView,
        canDownload: input.canDownload,
        releaseCondition: input.releaseCondition,
        conditionNotes: input.conditionNotes,
        isActive: true,
        revokedAt: null,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };

      rules.unshift(rule);
      return hydrateRule(rule);
    },
    async updateRule(ruleId, input) {
      const rule = rules.find((item) => item.id === ruleId);
      if (!rule) {
        return null;
      }

      Object.assign(rule, {
        nomineeId: input.nomineeId ?? rule.nomineeId,
        documentId: input.documentId ?? rule.documentId,
        categoryId: input.categoryId ?? rule.categoryId,
        canView: input.canView ?? rule.canView,
        canDownload: input.canDownload ?? rule.canDownload,
        releaseCondition: input.releaseCondition ?? rule.releaseCondition,
        conditionNotes: input.conditionNotes ?? rule.conditionNotes,
        updatedAt: now(),
      });

      return hydrateRule(rule);
    },
    async revokeRule(ruleId) {
      const rule = rules.find((item) => item.id === ruleId);
      if (!rule) {
        return null;
      }

      Object.assign(rule, {
        isActive: false,
        revokedAt: now(),
        deletedAt: null,
        updatedAt: now(),
      });

      return hydrateRule(rule);
    },
    async deleteRule(ruleId) {
      const rule = rules.find((item) => item.id === ruleId);
      if (!rule) {
        return null;
      }

      Object.assign(rule, {
        isActive: false,
        deletedAt: now(),
        updatedAt: now(),
      });

      return hydrateRule(rule);
    },
    async reactivateRule(ruleId) {
      const rule = rules.find((item) => item.id === ruleId);
      if (!rule) {
        return null;
      }

      Object.assign(rule, {
        isActive: true,
        revokedAt: null,
        deletedAt: null,
        updatedAt: now(),
      });

      return hydrateRule(rule);
    },
    async listHistory(ruleId) {
      return history.filter((entry) => entry.accessRuleId === ruleId);
    },
    async insertRuleHistory(entry) {
      history.unshift({
        id: `history-${history.length + 1}`,
        createdAt: now(),
        ...entry,
      });
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push(entry);
    },
    async findNomineeById(nomineeId) {
      return nominees.find((item) => item.id === nomineeId) ?? null;
    },
    async findDocumentById(documentId) {
      return documents.find((item) => item.id === documentId) ?? null;
    },
    async findDocumentCategoryById(categoryId) {
      return categories.find((item) => item.id === categoryId) ?? null;
    },
    async listDocumentCategories() {
      return categories;
    },
    async listPermissionsForUser(userId) {
      if (userId === "admin-1") {
        return ["ADMIN_VIEW_AUDIT_LOG"];
      }

      return ["USER_MANAGE_ACCESS_RULE"];
    },
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

test("access rule lifecycle records history and audit events", async () => {
  const store = createAccessRuleTestStore();
  const accessRuleService = createAccessRuleService(testEnv, createLogger("silent"), store);

  await withServer(
    {
      accessRule: {
        resolveAuthSnapshot: async () => createCustomerPrincipal(),
        accessRuleService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/access-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomineeId: "nominee-1",
          documentId: "document-1",
          canView: true,
          canDownload: true,
          releaseCondition: "DEATH_EVENT",
          conditionNotes: "Owner approved for estate release.",
        }),
      });

      assert.equal(createResponse.status, 201);
      const createJson = await createResponse.json();
      assert.equal(createJson.data.rule.scopeType, "DOCUMENT");
      assert.equal(createJson.data.rule.status, "ACTIVE");

      const listResponse = await fetch(`${baseUrl}/api/v1/access-rules`);
      assert.equal(listResponse.status, 200);
      const listJson = await listResponse.json();
      assert.equal(listJson.data.rules.length, 1);

      const ruleId = createJson.data.rule.id;

      const detailResponse = await fetch(`${baseUrl}/api/v1/access-rules/${ruleId}`);
      assert.equal(detailResponse.status, 200);
      const detailJson = await detailResponse.json();
      assert.equal(detailJson.data.history.length, 1);
      assert.equal(detailJson.data.history[0].action, "CREATED");

      const updateResponse = await fetch(`${baseUrl}/api/v1/access-rules/${ruleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conditionNotes: "Updated release note.",
        }),
      });
      assert.equal(updateResponse.status, 200);
      const updateJson = await updateResponse.json();
      assert.equal(updateJson.data.rule.conditionNotes, "Updated release note.");

      const revokeResponse = await fetch(`${baseUrl}/api/v1/access-rules/${ruleId}/revoke`, {
        method: "POST",
      });
      assert.equal(revokeResponse.status, 200);
      const revokeJson = await revokeResponse.json();
      assert.equal(revokeJson.data.rule.status, "REVOKED");

      const reactivateResponse = await fetch(`${baseUrl}/api/v1/access-rules/${ruleId}/reactivate`, {
        method: "POST",
      });
      assert.equal(reactivateResponse.status, 200);
      const reactivateJson = await reactivateResponse.json();
      assert.equal(reactivateJson.data.rule.status, "ACTIVE");

      const deleteResponse = await fetch(`${baseUrl}/api/v1/access-rules/${ruleId}`, {
        method: "DELETE",
      });
      assert.equal(deleteResponse.status, 200);
      const deleteJson = await deleteResponse.json();
      assert.equal(deleteJson.data.rule.status, "DELETED");

      const finalDetailResponse = await fetch(`${baseUrl}/api/v1/access-rules/${ruleId}`);
      const finalDetailJson = await finalDetailResponse.json();
      assert.equal(finalDetailJson.data.history.length, 5);

      assert.deepEqual(
        store.auditLogs.map((entry) => entry.action),
        [
          "ACCESS_RULE_CREATED",
          "ACCESS_RULE_UPDATED",
          "ACCESS_RULE_REVOKED",
          "ACCESS_RULE_REACTIVATED",
          "ACCESS_RULE_DELETED",
        ]
      );
    }
  );
});

test("access rule API rejects invalid scope and ownership violations", async () => {
  const store = createAccessRuleTestStore();
  const accessRuleService = createAccessRuleService(testEnv, createLogger("silent"), store);

  await withServer(
    {
      accessRule: {
        resolveAuthSnapshot: async () => createCustomerPrincipal(),
        accessRuleService,
      },
    },
    async (baseUrl) => {
      const invalidResponse = await fetch(`${baseUrl}/api/v1/access-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomineeId: "nominee-1",
          documentId: "document-1",
          canView: false,
          canDownload: true,
          releaseCondition: "LEGAL_EVENT",
        }),
      });

      assert.equal(invalidResponse.status, 400);

      const forbiddenDocumentResponse = await fetch(`${baseUrl}/api/v1/access-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomineeId: "nominee-1",
          documentId: "document-2",
          canView: true,
          canDownload: false,
          releaseCondition: "LEGAL_EVENT",
        }),
      });
      assert.equal(forbiddenDocumentResponse.status, 404);

      const forbiddenNomineeResponse = await fetch(`${baseUrl}/api/v1/access-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomineeId: "nominee-2",
          categoryId: "category-1",
          canView: true,
          canDownload: false,
          releaseCondition: "OWNER_INACTIVE",
        }),
      });
      assert.equal(forbiddenNomineeResponse.status, 404);

      const firstRuleResponse = await fetch(`${baseUrl}/api/v1/access-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomineeId: "nominee-1",
          categoryId: "category-1",
          canView: true,
          canDownload: false,
          releaseCondition: "OWNER_INACTIVE",
        }),
      });
      assert.equal(firstRuleResponse.status, 201);

      const duplicateResponse = await fetch(`${baseUrl}/api/v1/access-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomineeId: "nominee-1",
          categoryId: "category-1",
          canView: true,
          canDownload: false,
          releaseCondition: "OWNER_INACTIVE",
        }),
      });
      assert.equal(duplicateResponse.status, 409);
    }
  );
});

test("admin access rules endpoint returns the administrative view", async () => {
  const store = createAccessRuleTestStore();
  const accessRuleService = createAccessRuleService(testEnv, createLogger("silent"), store);

  await withServer(
    {
      accessRule: {
        resolveAuthSnapshot: async (request) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (url.pathname.startsWith("/api/v1/admin/access-rules")) {
            return createAdminPrincipal();
          }

          return createCustomerPrincipal();
        },
        accessRuleService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/access-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomineeId: "nominee-1",
          documentId: "document-1",
          canView: true,
          canDownload: true,
          releaseCondition: "EMERGENCY_ACCESS",
        }),
      });
      assert.equal(createResponse.status, 201);

      const adminResponse = await fetch(`${baseUrl}/api/v1/admin/access-rules`);
      assert.equal(adminResponse.status, 200);
      const adminJson = await adminResponse.json();
      assert.equal(adminJson.data.rules.length, 1);
    }
  );
});
