import type { Pool } from "pg";

import type {
  CreateDocumentInput,
  CreateVaultInput,
  DocumentCategoryRecord,
  DocumentRecord,
  DocumentViewRecord,
  UpdateDocumentInput,
  UpdateVaultInput,
  VaultRecord,
} from "./types.js";

function toIso(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toVault(row: Record<string, unknown>): VaultRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    vaultName: String(row.vault_name),
    description: row.description ? String(row.description) : null,
    status: String(row.status) as VaultRecord["status"],
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function toCategory(row: Record<string, unknown>): DocumentCategoryRecord {
  return {
    id: String(row.id),
    categoryName: String(row.category_name),
    description: row.description ? String(row.description) : null,
    isActive: Boolean(row.is_active),
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function toDocument(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    vaultId: String(row.vault_id),
    customerId: String(row.customer_id),
    categoryId: String(row.category_id),
    documentTitle: String(row.document_title),
    documentDescription: row.document_description ? String(row.document_description) : null,
    originalFileName: row.original_file_name ? String(row.original_file_name) : null,
    encryptedFilePath: String(row.encrypted_file_path),
    fileMimeType: row.file_mime_type ? String(row.file_mime_type) : null,
    fileSize: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    fileHash: row.file_hash ? String(row.file_hash) : null,
    encryptionKeyRef: row.encryption_key_ref ? String(row.encryption_key_ref) : null,
    status: String(row.status) as DocumentRecord["status"],
    uploadedAt: toIso(row.uploaded_at as string | Date | null) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function toDocumentView(row: Record<string, unknown>): DocumentViewRecord {
  return {
    ...toDocument(row),
    vaultName: String(row.vault_name),
    categoryName: String(row.category_name),
    categoryDescription: row.category_description ? String(row.category_description) : null,
  };
}

export type VaultStore = {
  listVaults(customerId: string): Promise<VaultRecord[]>;
  findVaultById(vaultId: string): Promise<VaultRecord | null>;
  createVault(input: CreateVaultInput): Promise<VaultRecord>;
  updateVault(vaultId: string, input: UpdateVaultInput): Promise<VaultRecord | null>;
  deleteVault(vaultId: string): Promise<VaultRecord | null>;
  listDocumentCategories(): Promise<DocumentCategoryRecord[]>;
  findDocumentCategoryById(categoryId: string): Promise<DocumentCategoryRecord | null>;
  findDocumentCategoryByName(categoryName: string): Promise<DocumentCategoryRecord | null>;
  listDocuments(customerId: string, vaultId?: string | null): Promise<DocumentViewRecord[]>;
  findDocumentById(documentId: string): Promise<DocumentViewRecord | null>;
  createDocument(input: CreateDocumentInput): Promise<DocumentViewRecord>;
  updateDocument(documentId: string, input: UpdateDocumentInput): Promise<DocumentViewRecord | null>;
  deleteDocument(documentId: string): Promise<DocumentViewRecord | null>;
  deleteDocumentsByVaultId(vaultId: string): Promise<DocumentViewRecord[]>;
};

export function createPostgresVaultStore(pool: Pool): VaultStore {
  async function findDocumentViewById(documentId: string) {
    const result = await pool.query(
      `SELECT
         d.id,
         d.vault_id,
         d.customer_id,
         d.category_id,
         d.document_title,
         d.document_description,
         d.original_file_name,
         d.encrypted_file_path,
         d.file_mime_type,
         d.file_size,
         d.file_hash,
         d.encryption_key_ref,
         d.status,
         d.uploaded_at,
         d.updated_at,
         v.vault_name,
         c.category_name,
         c.description AS category_description
       FROM documents d
       INNER JOIN vaults v ON v.id = d.vault_id
       INNER JOIN document_categories c ON c.id = d.category_id
       WHERE d.id = $1
       LIMIT 1`,
      [documentId]
    );

    return result.rows[0] ? toDocumentView(result.rows[0]) : null;
  }

  return {
    async listVaults(customerId) {
      const result = await pool.query(
        `SELECT id, customer_id, vault_name, description, status, created_at, updated_at
         FROM vaults
         WHERE customer_id = $1
         ORDER BY created_at DESC`,
        [customerId]
      );

      return result.rows.map((row: Record<string, unknown>) => toVault(row));
    },
    async findVaultById(vaultId) {
      const result = await pool.query(
        `SELECT id, customer_id, vault_name, description, status, created_at, updated_at
         FROM vaults
         WHERE id = $1
         LIMIT 1`,
        [vaultId]
      );

      return result.rows[0] ? toVault(result.rows[0]) : null;
    },
    async createVault(input) {
      const result = await pool.query(
        `INSERT INTO vaults (customer_id, vault_name, description, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         RETURNING id, customer_id, vault_name, description, status, created_at, updated_at`,
        [input.customerId, input.vaultName, input.description]
      );

      return toVault(result.rows[0]);
    },
    async updateVault(vaultId, input) {
      const result = await pool.query(
        `UPDATE vaults
         SET vault_name = COALESCE($2, vault_name),
             description = COALESCE($3, description),
             status = COALESCE($4, status)
         WHERE id = $1
         RETURNING id, customer_id, vault_name, description, status, created_at, updated_at`,
        [vaultId, input.vaultName ?? null, input.description ?? null, input.status ?? null]
      );

      return result.rows[0] ? toVault(result.rows[0]) : null;
    },
    async deleteVault(vaultId) {
      const result = await pool.query(
        `DELETE FROM vaults
         WHERE id = $1
         RETURNING id, customer_id, vault_name, description, status, created_at, updated_at`,
        [vaultId]
      );

      return result.rows[0] ? toVault(result.rows[0]) : null;
    },
    async listDocumentCategories() {
      const result = await pool.query(
        `SELECT id, category_name, description, is_active, created_at
         FROM document_categories
         ORDER BY category_name`
      );

      return result.rows.map((row: Record<string, unknown>) => toCategory(row));
    },
    async findDocumentCategoryById(categoryId) {
      const result = await pool.query(
        `SELECT id, category_name, description, is_active, created_at
         FROM document_categories
         WHERE id = $1
         LIMIT 1`,
        [categoryId]
      );

      return result.rows[0] ? toCategory(result.rows[0]) : null;
    },
    async findDocumentCategoryByName(categoryName) {
      const result = await pool.query(
        `SELECT id, category_name, description, is_active, created_at
         FROM document_categories
         WHERE lower(category_name) = lower($1)
         LIMIT 1`,
        [categoryName]
      );

      return result.rows[0] ? toCategory(result.rows[0]) : null;
    },
    async listDocuments(customerId, vaultId) {
      const params: unknown[] = [customerId];
      const vaultClause = vaultId ? "AND d.vault_id = $2" : "";
      if (vaultId) {
        params.push(vaultId);
      }

      const result = await pool.query(
        `SELECT
           d.id,
           d.vault_id,
           d.customer_id,
           d.category_id,
           d.document_title,
           d.document_description,
           d.original_file_name,
           d.encrypted_file_path,
           d.file_mime_type,
           d.file_size,
           d.file_hash,
           d.encryption_key_ref,
           d.status,
           d.uploaded_at,
           d.updated_at,
           v.vault_name,
           c.category_name,
           c.description AS category_description
         FROM documents d
         INNER JOIN vaults v ON v.id = d.vault_id
         INNER JOIN document_categories c ON c.id = d.category_id
         WHERE d.customer_id = $1 ${vaultClause}
         ORDER BY d.updated_at DESC`,
        params
      );

      return result.rows.map((row: Record<string, unknown>) => toDocumentView(row));
    },
    async findDocumentById(documentId) {
      return findDocumentViewById(documentId);
    },
    async createDocument(input) {
      const result = await pool.query(
        `INSERT INTO documents
          (vault_id, customer_id, category_id, document_title, document_description, original_file_name, encrypted_file_path, file_mime_type, file_size, file_hash, encryption_key_ref, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ACTIVE')
         RETURNING
           id, vault_id, customer_id, category_id, document_title, document_description, original_file_name,
           encrypted_file_path, file_mime_type, file_size, file_hash, encryption_key_ref, status, uploaded_at, updated_at`,
        [
          input.vaultId,
          input.customerId,
          input.categoryId,
          input.documentTitle,
          input.documentDescription,
          input.originalFileName,
          input.encryptedFilePath,
          input.fileMimeType,
          input.fileSize,
          input.fileHash,
          input.encryptionKeyRef,
        ]
      );

      const view = await findDocumentViewById(String(result.rows[0].id));
      if (!view) {
        throw new Error("Failed to create document record.");
      }

      return view;
    },
    async updateDocument(documentId, input) {
      const result = await pool.query(
        `UPDATE documents
         SET document_title = COALESCE($2, document_title),
             document_description = COALESCE($3, document_description),
             category_id = COALESCE($4, category_id),
             status = COALESCE($5, status)
         WHERE id = $1
         RETURNING id`,
        [documentId, input.documentTitle ?? null, input.documentDescription ?? null, input.categoryId ?? null, input.status ?? null]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findDocumentViewById(documentId);
    },
    async deleteDocument(documentId) {
      const existing = await findDocumentViewById(documentId);
      if (!existing) {
        return null;
      }

      const result = await pool.query(
        `DELETE FROM documents
         WHERE id = $1
         RETURNING id`,
        [documentId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return existing;
    },
    async deleteDocumentsByVaultId(vaultId) {
      const documents = await pool.query(
        `SELECT
           d.id,
           d.vault_id,
           d.customer_id,
           d.category_id,
           d.document_title,
           d.document_description,
           d.original_file_name,
           d.encrypted_file_path,
           d.file_mime_type,
           d.file_size,
           d.file_hash,
           d.encryption_key_ref,
           d.status,
           d.uploaded_at,
           d.updated_at,
           v.vault_name,
           c.category_name,
           c.description AS category_description
         FROM documents d
         INNER JOIN vaults v ON v.id = d.vault_id
         INNER JOIN document_categories c ON c.id = d.category_id
         WHERE d.vault_id = $1`,
        [vaultId]
      );

      await pool.query("DELETE FROM documents WHERE vault_id = $1", [vaultId]);
      return documents.rows.map((row: Record<string, unknown>) => toDocumentView(row));
    },
  };
}
