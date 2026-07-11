import type { UserRole } from "../auth/types.js";

export type VaultStatus = "ACTIVE" | "LOCKED" | "NEEDS_REVIEW";

export type VaultRecord = {
  id: string;
  customerId: string;
  vaultName: string;
  description: string | null;
  status: VaultStatus;
  createdAt: string;
  updatedAt: string;
};

export type DocumentCategoryRecord = {
  id: string;
  categoryName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
};

export type DocumentStatus = "ACTIVE" | "ARCHIVED" | "DELETED";

export type DocumentRecord = {
  id: string;
  vaultId: string;
  customerId: string;
  categoryId: string;
  documentTitle: string;
  documentDescription: string | null;
  originalFileName: string | null;
  encryptedFilePath: string;
  fileMimeType: string | null;
  fileSize: number | null;
  fileHash: string | null;
  encryptionKeyRef: string | null;
  status: DocumentStatus;
  uploadedAt: string;
  updatedAt: string;
};

export type DocumentViewRecord = DocumentRecord & {
  vaultName: string;
  categoryName: string;
  categoryDescription: string | null;
};

export type CreateVaultInput = {
  customerId: string;
  vaultName: string;
  description: string | null;
};

export type UpdateVaultInput = {
  vaultName?: string | null;
  description?: string | null;
  status?: VaultStatus | null;
};

export type CreateDocumentInput = {
  customerId: string;
  vaultId: string;
  categoryId: string;
  documentTitle: string;
  documentDescription: string | null;
  originalFileName: string | null;
  encryptedFilePath: string;
  fileMimeType: string | null;
  fileSize: number | null;
  fileHash: string | null;
  encryptionKeyRef: string | null;
};

export type UpdateDocumentInput = {
  documentTitle?: string | null;
  documentDescription?: string | null;
  categoryId?: string | null;
  status?: DocumentStatus | null;
};

export type S3SignedUrl = {
  url: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
};

export type DocumentUploadStart = {
  document: DocumentViewRecord;
  upload: S3SignedUrl;
};

export type DocumentDownloadGrant = {
  document: DocumentViewRecord;
  download: S3SignedUrl;
};

export type VaultPrincipal = {
  user: {
    id: string;
    role: UserRole;
    email: string;
  };
};

