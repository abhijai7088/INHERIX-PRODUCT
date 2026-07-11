import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";
import { createVaultService } from "../dist/modules/vault/vault.service.js";

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
  AWS_ACCESS_KEY_ID: undefined,
  AWS_SECRET_ACCESS_KEY: undefined,
  AWS_SESSION_TOKEN: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createPrincipal() {
  return {
    user: {
      id: "customer-1",
      email: "customer@example.com",
      role: "CUSTOMER",
    },
    session: {
      id: "session-1",
    },
    accessToken: "token",
    authenticatedBy: "access",
  };
}

function createMemoryVaultStore() {
  const categories = [
    {
      id: "category-identity",
      categoryName: "Identity Documents",
      description: "Identity proof for controlled release.",
      isActive: true,
      createdAt: "2026-06-09T00:00:00.000Z",
    },
    {
      id: "category-legal",
      categoryName: "Legal Documents",
      description: "Legal continuity records.",
      isActive: true,
      createdAt: "2026-06-09T00:00:00.000Z",
    },
  ];
  const vaults = [
    {
      id: "vault-1",
      customerId: "customer-1",
      vaultName: "Primary Vault",
      description: "Encrypted continuity vault.",
      status: "ACTIVE",
      createdAt: "2026-06-09T00:00:00.000Z",
      updatedAt: "2026-06-09T00:00:00.000Z",
    },
  ];
  const documents = [];
  const auditLogs = [];
  const securityEvents = [];

  const store = {
    auditLogs,
    securityEvents,
    async listVaults(customerId) {
      return vaults.filter((vault) => vault.customerId === customerId);
    },
    async findVaultById(vaultId) {
      return vaults.find((vault) => vault.id === vaultId) ?? null;
    },
    async createVault(input) {
      const vault = {
        id: `vault-${vaults.length + 1}`,
        customerId: input.customerId,
        vaultName: input.vaultName,
        description: input.description,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vaults.unshift(vault);
      return vault;
    },
    async updateVault(vaultId, input) {
      const existing = vaults.find((vault) => vault.id === vaultId);
      if (!existing) {
        return null;
      }

      Object.assign(existing, {
        vaultName: input.vaultName ?? existing.vaultName,
        description: input.description ?? existing.description,
        status: input.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      });
      return existing;
    },
    async deleteVault(vaultId) {
      const index = vaults.findIndex((vault) => vault.id === vaultId);
      if (index < 0) {
        return null;
      }

      const [removed] = vaults.splice(index, 1);
      return removed;
    },
    async listDocumentCategories() {
      return categories;
    },
    async findDocumentCategoryById(categoryId) {
      return categories.find((category) => category.id === categoryId) ?? null;
    },
    async findDocumentCategoryByName(categoryName) {
      return categories.find((category) => category.categoryName.toLowerCase() === categoryName.toLowerCase()) ?? null;
    },
    async listDocuments(customerId, vaultId) {
      return documents.filter((document) => document.customerId === customerId && (!vaultId || document.vaultId === vaultId));
    },
    async findDocumentById(documentId) {
      return documents.find((document) => document.id === documentId) ?? null;
    },
    async createDocument(input) {
      const vault = vaults.find((item) => item.id === input.vaultId);
      const category = categories.find((item) => item.id === input.categoryId);
      const document = {
        id: `document-${documents.length + 1}`,
        vaultId: input.vaultId,
        customerId: input.customerId,
        categoryId: input.categoryId,
        documentTitle: input.documentTitle,
        documentDescription: input.documentDescription,
        originalFileName: input.originalFileName,
        encryptedFilePath: input.encryptedFilePath,
        fileMimeType: input.fileMimeType,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
        encryptionKeyRef: input.encryptionKeyRef,
        status: "ACTIVE",
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        vaultName: vault?.vaultName ?? "Unknown vault",
        categoryName: category?.categoryName ?? "Unknown category",
        categoryDescription: category?.description ?? null,
      };
      documents.unshift(document);
      return document;
    },
    async updateDocument(documentId, input) {
      const existing = documents.find((document) => document.id === documentId);
      if (!existing) {
        return null;
      }

      Object.assign(existing, {
        documentTitle: input.documentTitle ?? existing.documentTitle,
        documentDescription: input.documentDescription ?? existing.documentDescription,
        categoryId: input.categoryId ?? existing.categoryId,
        status: input.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      });
      return existing;
    },
    async deleteDocument(documentId) {
      const index = documents.findIndex((document) => document.id === documentId);
      if (index < 0) {
        return null;
      }

      const [removed] = documents.splice(index, 1);
      return removed;
    },
    async deleteDocumentsByVaultId(vaultId) {
      const removed = documents.filter((document) => document.vaultId === vaultId);
      for (let index = documents.length - 1; index >= 0; index -= 1) {
        if (documents[index].vaultId === vaultId) {
          documents.splice(index, 1);
        }
      }
      return removed;
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push(entry);
    },
    async findNomineeAssignment() {
      return null;
    },
  };

  return store;
}

function createFakeSigner() {
  return {
    signPutObject(key) {
      return {
        url: `https://uploads.example/${encodeURIComponent(key)}`,
        expiresAt: "2026-06-09T00:15:00.000Z",
        requiredHeaders: {
          "x-amz-server-side-encryption": "aws:kms",
          "x-amz-server-side-encryption-aws-kms-key-id": "kms-test",
        },
      };
    },
    signGetObject(key, fileName) {
      return {
        url: `https://downloads.example/${encodeURIComponent(key)}?name=${encodeURIComponent(fileName ?? "")}`,
        expiresAt: "2026-06-09T00:10:00.000Z",
        requiredHeaders: {},
      };
    },
    async signDeleteObject() {},
  };
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

test("vault endpoints enforce customer scope and signed upload flows", async () => {
  const principal = createPrincipal();
  const store = createMemoryVaultStore();
  const vaultService = createVaultService(testEnv, createLogger("silent"), store, createFakeSigner());

  await withServer(
    {
      vault: {
        resolveAuthSnapshot: async () => principal,
        vaultService,
      },
    },
    async (baseUrl) => {
      const categoryResponse = await fetch(`${baseUrl}/api/v1/document-categories`);
      assert.equal(categoryResponse.status, 200);
      const categoryJson = await categoryResponse.json();
      assert.equal(categoryJson.success, true);
      assert.equal(categoryJson.data.categories.length, 2);

      const createVaultResponse = await fetch(`${baseUrl}/api/v1/vaults`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultName: "Test Vault",
          description: "Vault for regression coverage",
        }),
      });
      assert.equal(createVaultResponse.status, 201);
      const createVaultJson = await createVaultResponse.json();
      assert.equal(createVaultJson.data.vault.vaultName, "Test Vault");

      const uploadResponse = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId: "vault-1",
          categoryId: "category-legal",
          documentTitle: "Will Document",
          documentDescription: "Encrypted continuity document",
          originalFileName: "will.pdf",
          fileMimeType: "application/pdf",
          fileSize: 1024,
          fileHash: null,
        }),
      });

      assert.equal(uploadResponse.status, 201);
      const uploadJson = await uploadResponse.json();
      assert.equal(uploadJson.data.document.documentTitle, "Will Document");
      assert.ok(uploadJson.data.upload.url.includes("uploads.example"));
      assert.equal(uploadJson.data.upload.requiredHeaders["x-amz-server-side-encryption"], "aws:kms");

      const downloadResponse = await fetch(`${baseUrl}/api/v1/documents/${uploadJson.data.document.id}/download`);
      assert.equal(downloadResponse.status, 200);
      const downloadJson = await downloadResponse.json();
      assert.ok(downloadJson.data.download.url.includes("downloads.example"));
      assert.equal(store.auditLogs.at(-1)?.action, "DOCUMENT_DOWNLOAD_URL_ISSUED");
    }
  );
});

