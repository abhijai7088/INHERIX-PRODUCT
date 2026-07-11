import type { Pool } from "pg";

import type {
  AccessRuleAction,
  AccessRuleCreateInput,
  AccessRuleFilterInput,
  AccessRuleHistoryRecord,
  AccessRuleReleaseCondition,
  AccessRuleStatus,
  AccessRuleUpdateInput,
  DocumentAccessRuleRecord,
} from "./types.js";
import type { UserRole } from "../auth/types.js";

function toIso(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toStatus(row: Record<string, unknown>): AccessRuleStatus {
  if (row.deleted_at) {
    return "DELETED";
  }

  if (!Boolean(row.is_active)) {
    return "REVOKED";
  }

  return "ACTIVE";
}

function toRule(row: Record<string, unknown>): DocumentAccessRuleRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    nomineeId: String(row.nominee_id),
    documentId: row.document_id ? String(row.document_id) : null,
    categoryId: row.category_id ? String(row.category_id) : null,
    scopeType: row.document_id ? "DOCUMENT" : "CATEGORY",
    canView: Boolean(row.can_view),
    canDownload: Boolean(row.can_download),
    releaseCondition: String(row.release_condition) as AccessRuleReleaseCondition,
    conditionNotes: row.condition_notes ? String(row.condition_notes) : null,
    isActive: Boolean(row.is_active) && !row.deleted_at,
    revokedAt: toIso(row.revoked_at as string | Date | null),
    deletedAt: toIso(row.deleted_at as string | Date | null),
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
    nomineeFullName: String(row.nominee_full_name),
    nomineeEmail: row.nominee_email ? String(row.nominee_email) : null,
    documentTitle: row.document_title ? String(row.document_title) : null,
    categoryName: row.category_name ? String(row.category_name) : null,
    status: toStatus(row),
  };
}

function toHistory(row: Record<string, unknown>): AccessRuleHistoryRecord {
  return {
    id: String(row.id),
    accessRuleId: String(row.access_rule_id),
    action: String(row.action) as AccessRuleAction,
    customerId: String(row.customer_id),
    nomineeId: String(row.nominee_id),
    performedBy: row.performed_by ? String(row.performed_by) : null,
    performedRole: row.performed_role ? (String(row.performed_role) as UserRole) : null,
    oldValue: (row.old_value as Record<string, unknown> | null) ?? null,
    newValue: (row.new_value as Record<string, unknown> | null) ?? null,
    reason: row.reason ? String(row.reason) : null,
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
  };
}

export type AccessRuleStore = {
  listRules(customerId: string | null, filters?: AccessRuleFilterInput): Promise<DocumentAccessRuleRecord[]>;
  findRuleById(ruleId: string): Promise<DocumentAccessRuleRecord | null>;
  findRuleByScope(
    customerId: string,
    nomineeId: string,
    documentId: string | null,
    categoryId: string | null,
    excludeRuleId?: string | null
  ): Promise<DocumentAccessRuleRecord | null>;
  createRule(input: AccessRuleCreateInput & { customerId: string }): Promise<DocumentAccessRuleRecord>;
  updateRule(ruleId: string, input: AccessRuleUpdateInput): Promise<DocumentAccessRuleRecord | null>;
  revokeRule(ruleId: string): Promise<DocumentAccessRuleRecord | null>;
  deleteRule(ruleId: string): Promise<DocumentAccessRuleRecord | null>;
  reactivateRule(ruleId: string): Promise<DocumentAccessRuleRecord | null>;
  listHistory(ruleId: string): Promise<AccessRuleHistoryRecord[]>;
  insertRuleHistory(input: {
    accessRuleId: string;
    customerId: string;
    nomineeId: string;
    action: AccessRuleAction;
    performedBy: string | null;
    performedRole: string | null;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    reason: string | null;
  }): Promise<void>;
};

function buildFilterClause(params: unknown[], filters?: AccessRuleFilterInput) {
  const clauses: string[] = [];

  if (filters?.nomineeId) {
    params.push(filters.nomineeId);
    clauses.push(`ar.nominee_id = $${params.length}`);
  }

  if (filters?.documentId) {
    params.push(filters.documentId);
    clauses.push(`ar.document_id = $${params.length}`);
  }

  if (filters?.categoryId) {
    params.push(filters.categoryId);
    clauses.push(`ar.category_id = $${params.length}`);
  }

  if (filters?.status === "ACTIVE") {
    clauses.push("ar.is_active = TRUE AND ar.deleted_at IS NULL");
  } else if (filters?.status === "REVOKED") {
    clauses.push("ar.is_active = FALSE AND ar.deleted_at IS NULL");
  } else if (filters?.status === "DELETED") {
    clauses.push("ar.deleted_at IS NOT NULL");
  }

  return clauses;
}

function buildRuleSelect(filterClause = "") {
  return `
    SELECT
      ar.id,
      ar.customer_id,
      ar.nominee_id,
      ar.document_id,
      ar.category_id,
      ar.can_view,
      ar.can_download,
      ar.release_condition,
      ar.condition_notes,
      ar.is_active,
      ar.revoked_at,
      ar.deleted_at,
      ar.created_at,
      ar.updated_at,
      n.full_name AS nominee_full_name,
      n.email AS nominee_email,
      d.document_title,
      c.category_name
    FROM document_access_rules ar
    INNER JOIN nominees n ON n.id = ar.nominee_id
    LEFT JOIN documents d ON d.id = ar.document_id
    LEFT JOIN document_categories c ON c.id = ar.category_id
    ${filterClause}
    ORDER BY ar.updated_at DESC, ar.created_at DESC`;
}

export function createPostgresAccessRuleStore(pool: Pool): AccessRuleStore {
  async function findRule(ruleId: string) {
    const result = await pool.query(
      `${buildRuleSelect("WHERE ar.id = $1")}
       LIMIT 1`,
      [ruleId]
    );

    return result.rows[0] ? toRule(result.rows[0]) : null;
  }

  async function findHistory(ruleId: string) {
    const result = await pool.query(
      `SELECT id, access_rule_id, action, customer_id, nominee_id, performed_by, performed_role, old_value, new_value, reason, created_at
       FROM document_access_rule_history
       WHERE access_rule_id = $1
       ORDER BY created_at DESC`,
      [ruleId]
    );

    return result.rows.map((row: Record<string, unknown>) => toHistory(row));
  }

  return {
    async listRules(customerId, filters) {
      const params: unknown[] = [];
      const whereParts: string[] = [];
      if (customerId) {
        params.push(customerId);
        whereParts.push(`ar.customer_id = $${params.length}`);
      }

      whereParts.push(...buildFilterClause(params, filters));

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
      const query = buildRuleSelect(whereClause);
      const result = await pool.query(query, params);
      return result.rows.map((row: Record<string, unknown>) => toRule(row));
    },
    async findRuleById(ruleId) {
      return findRule(ruleId);
    },
    async findRuleByScope(customerId, nomineeId, documentId, categoryId, excludeRuleId) {
      const params: unknown[] = [customerId, nomineeId, documentId, categoryId];
      const excludeClause = excludeRuleId ? `AND ar.id <> $5` : "";
      if (excludeRuleId) {
        params.push(excludeRuleId);
      }

      const result = await pool.query(
        `${buildRuleSelect(`WHERE ar.customer_id = $1 AND ar.nominee_id = $2 AND ar.document_id IS NOT DISTINCT FROM $3 AND ar.category_id IS NOT DISTINCT FROM $4 ${excludeClause}`)}
         LIMIT 1`,
        params
      );

      return result.rows[0] ? toRule(result.rows[0]) : null;
    },
    async createRule(input) {
      const result = await pool.query(
        `INSERT INTO document_access_rules
          (customer_id, nominee_id, document_id, category_id, can_view, can_download, release_condition, condition_notes, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
         RETURNING id`,
        [
          input.customerId,
          input.nomineeId,
          input.documentId ?? null,
          input.categoryId ?? null,
          input.canView,
          input.canDownload,
          input.releaseCondition,
          input.conditionNotes,
        ]
      );

      const rule = await findRule(String(result.rows[0].id));
      if (!rule) {
        throw new Error("Failed to create access rule.");
      }

      return rule;
    },
    async updateRule(ruleId, input) {
      const result = await pool.query(
        `UPDATE document_access_rules
         SET nominee_id = COALESCE($2, nominee_id),
             document_id = COALESCE($3, document_id),
             category_id = COALESCE($4, category_id),
             can_view = COALESCE($5, can_view),
             can_download = COALESCE($6, can_download),
             release_condition = COALESCE($7, release_condition),
             condition_notes = COALESCE($8, condition_notes)
         WHERE id = $1
         RETURNING id`,
        [
          ruleId,
          input.nomineeId ?? null,
          input.documentId ?? null,
          input.categoryId ?? null,
          input.canView ?? null,
          input.canDownload ?? null,
          input.releaseCondition ?? null,
          input.conditionNotes ?? null,
        ]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findRule(ruleId);
    },
    async revokeRule(ruleId) {
      const result = await pool.query(
        `UPDATE document_access_rules
         SET is_active = FALSE,
             revoked_at = CURRENT_TIMESTAMP,
             deleted_at = NULL
         WHERE id = $1
         RETURNING id`,
        [ruleId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findRule(ruleId);
    },
    async deleteRule(ruleId) {
      const result = await pool.query(
        `UPDATE document_access_rules
         SET is_active = FALSE,
             deleted_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id`,
        [ruleId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findRule(ruleId);
    },
    async reactivateRule(ruleId) {
      const result = await pool.query(
        `UPDATE document_access_rules
         SET is_active = TRUE,
             revoked_at = NULL,
             deleted_at = NULL
         WHERE id = $1
         RETURNING id`,
        [ruleId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findRule(ruleId);
    },
    async listHistory(ruleId) {
      return findHistory(ruleId);
    },
    async insertRuleHistory(input) {
      await pool.query(
        `INSERT INTO document_access_rule_history
          (access_rule_id, customer_id, nominee_id, action, performed_by, performed_role, old_value, new_value, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          input.accessRuleId,
          input.customerId,
          input.nomineeId,
          input.action,
          input.performedBy,
          input.performedRole,
          input.oldValue ?? null,
          input.newValue ?? null,
          input.reason,
        ]
      );
    },
  };
}
