import { randomUUID } from "node:crypto";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { HttpError } from "../../utils/http.js";
import type { AuthRequestContext, UserRole } from "../auth/types.js";
import { assertRole } from "../rbac/rbac.guard.js";
import type { AuthStore } from "../auth/auth.store.js";
import type {
  CreateVaultInput,
  DocumentDownloadGrant,
  DocumentUploadStart,
  UpdateDocumentInput,
  UpdateVaultInput,
  VaultPrincipal,
} from "./types.js";
import { buildDocumentStorageKey, createDocumentEncryptionKeyRef, createS3Signer, type S3Signer } from "./s3.js";
import type { VaultStore } from "./vault.store.js";

type VaultServiceStore = VaultStore & Pick<AuthStore, "insertAuditLog" | "insertSecurityEvent" | "findNomineeAssignment">;

function requireCustomerRole(principal: VaultPrincipal) {
  assertRole(principal.user.role, ["CUSTOMER"], "Only the owning customer can manage vault documents.");
}

function makeModuleAuditInput(
  principal: VaultPrincipal,
  context: AuthRequestContext,
  action: string,
  entityType: string,
  entityId: string | null,
  newValue: Record<string, unknown> | null,
  oldValue: Record<string, unknown> | null = null
) {
  return {
    userId: principal.user.id,
    role: principal.user.role as UserRole,
    action,
    moduleName: "vault",
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
  };
}

function makeSecurityEvent(
  principal: VaultPrincipal | null,
  context: AuthRequestContext,
  eventType: string,
  eventDescription: string,
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
) {
  return {
    userId: principal?.user.id ?? null,
    eventType,
    eventDescription,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    riskLevel,
  };
}

export function createVaultService(
  env: AppEnv,
  logger: Logger,
  store: VaultServiceStore,
  s3?: S3Signer
) {
  logger.debug("Vault service initialized", {
    module: "vault",
  });
  let signer = s3;

  function getSigner() {
    if (!signer) {
      signer = createS3Signer(env);
    }

    return signer;
  }

  async function logAuditAndSecurity(
    principal: VaultPrincipal | null,
    context: AuthRequestContext,
    action: string,
    entityType: string,
    entityId: string | null,
    newValue: Record<string, unknown> | null,
    oldValue: Record<string, unknown> | null = null,
    eventType?: string,
    eventDescription?: string,
    riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW"
  ) {
    if (!principal) {
      return;
    }

    await store.insertAuditLog(makeModuleAuditInput(principal, context, action, entityType, entityId, newValue, oldValue));

    await store.insertSecurityEvent(
      makeSecurityEvent(
        principal,
        context,
        eventType ?? action,
        eventDescription ?? `${action} completed successfully.`,
        riskLevel
      )
    );
  }

  async function ensureVaultOwnership(principal: VaultPrincipal, vaultId: string) {
    requireCustomerRole(principal);

    const vault = await store.findVaultById(vaultId);
    if (!vault || vault.customerId !== principal.user.id) {
      throw new HttpError(404, "VAULT_NOT_FOUND", "Vault not found.");
    }

    return vault;
  }

  async function ensureDocumentOwnership(principal: VaultPrincipal, documentId: string) {
    requireCustomerRole(principal);

    const document = await store.findDocumentById(documentId);
    if (!document || document.customerId !== principal.user.id) {
      throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
    }

    return document;
  }

  return {
    async listVaults(principal: VaultPrincipal) {
      requireCustomerRole(principal);
      return store.listVaults(principal.user.id);
    },
    async listDocumentCategories() {
      const categories = await store.listDocumentCategories();
      return categories.filter((category) => category.isActive);
    },
    async createVault(principal: VaultPrincipal, input: CreateVaultInput, context: AuthRequestContext) {
      const vault = await store.createVault(input);
      await logAuditAndSecurity(principal, context, "VAULT_CREATED", "vault", vault.id, {
        vaultName: vault.vaultName,
        status: vault.status,
      });
      return vault;
    },
    async updateVault(principal: VaultPrincipal, vaultId: string, input: UpdateVaultInput, context: AuthRequestContext) {
      const current = await ensureVaultOwnership(principal, vaultId);
      const updated = await store.updateVault(vaultId, input);
      if (!updated) {
        throw new HttpError(404, "VAULT_NOT_FOUND", "Vault not found.");
      }

      await logAuditAndSecurity(principal, context, "VAULT_UPDATED", "vault", vaultId, {
        vaultName: updated.vaultName,
        status: updated.status,
      }, {
        vaultName: current.vaultName,
        status: current.status,
      });

      return updated;
    },
    async deleteVault(principal: VaultPrincipal, vaultId: string, context: AuthRequestContext) {
      const vault = await ensureVaultOwnership(principal, vaultId);
      const documents = await store.listDocuments(principal.user.id, vaultId);

      for (const document of documents) {
        await getSigner().signDeleteObject(document.encryptedFilePath);
      }

      const deleted = await store.deleteVault(vaultId);
      if (!deleted) {
        throw new HttpError(404, "VAULT_NOT_FOUND", "Vault not found.");
      }

      await logAuditAndSecurity(principal, context, "VAULT_DELETED", "vault", vaultId, {
        vaultName: vault.vaultName,
        deletedDocumentCount: documents.length,
      });

      return deleted;
    },
    async listDocuments(principal: VaultPrincipal, vaultId: string | null) {
      requireCustomerRole(principal);

      if (vaultId) {
        await ensureVaultOwnership(principal, vaultId);
      }

      return store.listDocuments(principal.user.id, vaultId);
    },
    async getDocument(principal: VaultPrincipal, documentId: string) {
      const document = await ensureDocumentOwnership(principal, documentId);
      return document;
    },
    async createDocumentUpload(
      principal: VaultPrincipal,
      input: {
        vaultId: string;
        categoryId: string;
        documentTitle: string;
        documentDescription: string | null;
        originalFileName: string | null;
        fileMimeType: string | null;
        fileSize: number | null;
        fileHash: string | null;
      },
      context: AuthRequestContext
    ): Promise<DocumentUploadStart> {
      requireCustomerRole(principal);
      const vault = await ensureVaultOwnership(principal, input.vaultId);
      const category = await store.findDocumentCategoryById(input.categoryId);

      if (!category || !category.isActive) {
        throw new HttpError(400, "VALIDATION_ERROR", "A valid document category is required.");
      }

      const documentId = randomUUID();
      const encryptedFilePath = buildDocumentStorageKey(
        principal.user.id,
        vault.id,
        category.id,
        documentId,
        input.originalFileName
      );
      const document = await store.createDocument({
        customerId: principal.user.id,
        vaultId: vault.id,
        categoryId: category.id,
        documentTitle: input.documentTitle,
        documentDescription: input.documentDescription,
        originalFileName: input.originalFileName,
        encryptedFilePath,
        fileMimeType: input.fileMimeType,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
        encryptionKeyRef: createDocumentEncryptionKeyRef(documentId),
      });

      const upload = getSigner().signPutObject(document.encryptedFilePath, document.fileMimeType);

      await logAuditAndSecurity(principal, context, "DOCUMENT_UPLOAD_INITIATED", "document", document.id, {
        vaultId: document.vaultId,
        categoryId: document.categoryId,
        documentTitle: document.documentTitle,
        fileName: document.originalFileName,
        fileSize: document.fileSize,
      });

      return { document, upload };
    },
    async uploadDocumentContent(
      principal: VaultPrincipal,
      documentId: string,
      content: Buffer,
      context: AuthRequestContext
    ) {
      const document = await ensureDocumentOwnership(principal, documentId);
      const upload = getSigner().signPutObject(document.encryptedFilePath, document.fileMimeType);

      let response: Response;
      try {
        response = await fetch(upload.url, {
          method: "PUT",
          headers: upload.requiredHeaders,
          body: content,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new HttpError(
          502,
          "S3_UPLOAD_FAILED",
          `The document could not be written to S3. ${message}`
        );
      }

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new HttpError(
          502,
          "S3_UPLOAD_FAILED",
          details
            ? `The document could not be written to S3. ${details.slice(0, 250)}`
            : "The document could not be written to S3."
        );
      }

      await logAuditAndSecurity(principal, context, "DOCUMENT_UPLOAD_COMPLETED", "document", document.id, {
        documentTitle: document.documentTitle,
        fileName: document.originalFileName,
        storageMode: "server-relay",
      });

      return {
        document,
      };
    },
    async updateDocument(
      principal: VaultPrincipal,
      documentId: string,
      input: UpdateDocumentInput,
      context: AuthRequestContext
    ) {
      const current = await ensureDocumentOwnership(principal, documentId);
      const updated = await store.updateDocument(documentId, input);

      if (!updated) {
        throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
      }

      await logAuditAndSecurity(principal, context, "DOCUMENT_UPDATED", "document", documentId, {
        title: updated.documentTitle,
        status: updated.status,
      }, {
        title: current.documentTitle,
        status: current.status,
      });

      return updated;
    },
    async deleteDocument(principal: VaultPrincipal, documentId: string, context: AuthRequestContext) {
      const document = await ensureDocumentOwnership(principal, documentId);
      await getSigner().signDeleteObject(document.encryptedFilePath);

      const deleted = await store.deleteDocument(documentId);
      if (!deleted) {
        throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
      }

      await logAuditAndSecurity(principal, context, "DOCUMENT_DELETED", "document", documentId, {
        documentTitle: document.documentTitle,
      });

      return document;
    },
    async getDocumentDownload(
      principal: VaultPrincipal,
      documentId: string,
      context: AuthRequestContext
    ): Promise<DocumentDownloadGrant> {
      const document = await ensureDocumentOwnership(principal, documentId);
      const download = getSigner().signGetObject(document.encryptedFilePath, document.originalFileName, "attachment");

      await logAuditAndSecurity(principal, context, "DOCUMENT_DOWNLOAD_URL_ISSUED", "document", document.id, {
        documentTitle: document.documentTitle,
        expiresAt: download.expiresAt,
      });

      return { document, download };
    },
    async getVaultById(principal: VaultPrincipal, vaultId: string) {
      return ensureVaultOwnership(principal, vaultId);
    },
  };
}

export type VaultService = ReturnType<typeof createVaultService>;
