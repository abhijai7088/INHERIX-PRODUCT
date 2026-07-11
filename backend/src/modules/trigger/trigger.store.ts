import type { Pool } from "pg";

import type { UserRole } from "../auth/types.js";
import type {
  TriggerActorRole,
  TriggerProofRecord,
  TriggerRequestKind,
  TriggerRequestPriority,
  TriggerRequestRecord,
  TriggerRequestStatus,
  TriggerTimelineEntry,
} from "./types.js";

type NullableDate = string | Date | null | undefined;

function toIso(value: NullableDate) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeActorRole(value: unknown): TriggerActorRole {
  const normalized = String(value ?? "system").toLowerCase();
  if (normalized === "customer" || normalized === "nominee" || normalized === "admin") {
    return normalized;
  }

  return "system";
}

function mapTriggerRequest(row: Record<string, unknown>): TriggerRequestRecord {
  const accessRuleCanView = row.access_rule_can_view === null || row.access_rule_can_view === undefined
    ? null
    : Boolean(row.access_rule_can_view);
  const accessRuleCanDownload =
    accessRuleCanView === null || row.access_rule_can_download === null || row.access_rule_can_download === undefined
      ? null
      : accessRuleCanView && Boolean(row.access_rule_can_download);

  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    customerName: String(row.customer_full_name ?? row.customer_name ?? "Customer"),
    nomineeId: String(row.nominee_id),
    nomineeUserId: row.nominee_user_id ? String(row.nominee_user_id) : null,
    documentId: row.document_id ? String(row.document_id) : null,
    documentTitle: row.document_title ? String(row.document_title) : null,
    accessRuleId: row.access_rule_id ? String(row.access_rule_id) : null,
    accessRuleScope: row.access_rule_document_id ? "DOCUMENT" : row.access_rule_category_id ? "CATEGORY" : null,
    accessRuleCanView,
    accessRuleCanDownload,
    accessRuleCondition: row.access_rule_condition ? String(row.access_rule_condition) : null,
    accessRuleNotes: row.access_rule_notes ? String(row.access_rule_notes) : null,
    nomineeName: String(row.nominee_full_name),
    nomineeEmail: row.nominee_email ? String(row.nominee_email) : null,
    nomineeMobile: row.nominee_mobile ? String(row.nominee_mobile) : null,
    relationship: String(row.relationship),
    customRelationship: row.custom_relationship ? String(row.custom_relationship) : null,
    requestKind: String(row.request_kind) as TriggerRequestKind,
    subjectLine: String(row.subject_line),
    summary: row.reason ? String(row.reason) : "",
    priority: String(row.priority) as TriggerRequestPriority,
    status: String(row.status) as TriggerRequestStatus,
    submittedAt: toIso(row.submitted_at as NullableDate),
    reviewedAt: toIso(row.reviewed_at as NullableDate),
    resolvedAt: toIso(row.resolved_at as NullableDate),
    cancelledAt: toIso(row.cancelled_at as NullableDate),
    additionalInfoRequestedAt: toIso(row.additional_info_requested_at as NullableDate),
    additionalInfoReason: row.additional_info_reason ? String(row.additional_info_reason) : null,
    adminDecisionNote: row.admin_remarks ? String(row.admin_remarks) : null,
    latestActivityAt: toIso(row.latest_activity_at as NullableDate) ?? new Date().toISOString(),
    createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as NullableDate) ?? new Date().toISOString(),
    requestedByUserId: row.requested_by_user_id ? String(row.requested_by_user_id) : null,
    lastActionByUserId: row.last_action_by_user_id ? String(row.last_action_by_user_id) : null,
    lastActionByName: row.last_action_by_name ? String(row.last_action_by_name) : null,
    lastActionRole: normalizeActorRole(row.last_action_role),
    proofCount: Number(row.proof_count ?? 0),
  };
}

function mapTriggerProof(row: Record<string, unknown>): TriggerProofRecord {
  return {
    id: String(row.id),
    requestId: String(row.trigger_request_id),
    fileName: String(row.original_file_name ?? "proof"),
    fileType: String(row.file_mime_type ?? "application/octet-stream"),
    fileSize: Number(row.file_size ?? 0),
    fileHash: row.file_hash ? String(row.file_hash) : null,
    notes: row.notes ? String(row.notes) : null,
    uploadedBy: row.uploaded_by_name ? String(row.uploaded_by_name) : null,
    uploadedByRole: normalizeActorRole(row.uploaded_by_role),
    verificationStatus: String(row.verification_status) as TriggerProofRecord["verificationStatus"],
    adminRemarks: row.admin_remarks ? String(row.admin_remarks) : null,
    createdAt: toIso(row.uploaded_at as NullableDate) ?? new Date().toISOString(),
  };
}

function mapTimelineEntry(row: Record<string, unknown>): TriggerTimelineEntry {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    action: String(row.action),
    status: String(row.status) as TriggerRequestStatus,
    actorName: String(row.actor_name),
    actorRole: normalizeActorRole(row.actor_role),
    summary: String(row.summary),
    createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
  };
}

export type TriggerRequestFilters = {
  status?: TriggerRequestStatus | null;
  requestKind?: TriggerRequestKind | null;
  documentId?: string | null;
};

export type CreateTriggerRequestInput = {
  customerId: string;
  nomineeId: string;
  documentId: string | null;
  requestKind: TriggerRequestKind;
  subjectLine: string;
  summary: string;
  priority: TriggerRequestPriority;
  requestedByUserId: string;
  requestedByRole: UserRole;
};

export type CreateTriggerProofInput = {
  triggerRequestId: string;
  uploadedByUserId: string;
  uploadedByRole: UserRole;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  fileHash: string | null;
  notes: string | null;
  encryptedFilePath: string;
};

export type TriggerStore = {
  findNomineeById(nomineeId: string): Promise<{
    id: string;
    customerId: string;
    nomineeUserId: string | null;
    fullName: string;
    email: string | null;
    mobile: string | null;
    relationship: string;
    customRelationship: string | null;
    status: string;
  } | null>;
  findNomineeByUserId(nomineeUserId: string): Promise<{
    id: string;
    customerId: string;
    nomineeUserId: string | null;
    fullName: string;
    email: string | null;
    mobile: string | null;
    relationship: string;
    customRelationship: string | null;
    status: string;
  } | null>;
  listRequestsByCustomer(customerId: string, filters?: TriggerRequestFilters): Promise<TriggerRequestRecord[]>;
  listRequestsByNomineeUserId(nomineeUserId: string, filters?: TriggerRequestFilters): Promise<TriggerRequestRecord[]>;
  listRequestsForAdmin(filters?: TriggerRequestFilters): Promise<TriggerRequestRecord[]>;
  findRequestById(requestId: string): Promise<TriggerRequestRecord | null>;
  createRequest(input: CreateTriggerRequestInput): Promise<TriggerRequestRecord>;
  submitRequest(requestId: string, actorUserId: string, actorRole: TriggerActorRole): Promise<TriggerRequestRecord | null>;
  updateRequestStatus(
    requestId: string,
    status: TriggerRequestStatus,
    actorUserId: string,
    actorRole: TriggerActorRole
  ): Promise<TriggerRequestRecord | null>;
  createProof(input: CreateTriggerProofInput): Promise<TriggerProofRecord>;
  listProofs(requestId: string): Promise<TriggerProofRecord[]>;
  findProofById(requestId: string, proofId: string): Promise<{ originalFileName: string | null; encryptedFilePath: string } | null>;
  deleteUnreviewedProof(requestId: string, proofId: string): Promise<{ encryptedFilePath: string } | null>;
  listTimeline(requestId: string): Promise<TriggerTimelineEntry[]>;
  updateProofVerification(
    requestId: string,
    proofId: string,
    verificationStatus: "VERIFIED" | "REJECTED",
    adminUserId: string,
    adminRemarks: string | null
  ): Promise<TriggerProofRecord | null>;
  updateRequestReview(
    requestId: string,
    status: TriggerRequestStatus,
    actorUserId: string,
    actorRole: TriggerActorRole,
    adminRemarks: string | null,
    additionalInfoReason?: string | null
  ): Promise<TriggerRequestRecord | null>;
  createVerificationNote(requestId: string, adminUserId: string, note: string): Promise<void>;
};

export function createPostgresTriggerStore(pool: Pool): TriggerStore {
  async function findNomineeById(nomineeId: string) {
    const result = await pool.query(
      `SELECT id, customer_id, nominee_user_id, full_name, email, mobile, relationship, custom_relationship, status
       FROM nominees
       WHERE id = $1
       LIMIT 1`,
      [nomineeId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      customerId: String(row.customer_id),
      nomineeUserId: row.nominee_user_id ? String(row.nominee_user_id) : null,
      fullName: String(row.full_name),
      email: row.email ? String(row.email) : null,
      mobile: row.mobile ? String(row.mobile) : null,
      relationship: String(row.relationship),
      customRelationship: row.custom_relationship ? String(row.custom_relationship) : null,
      status: String(row.status),
    };
  }

  async function findNomineeByUserId(nomineeUserId: string) {
    const result = await pool.query(
      `SELECT id, customer_id, nominee_user_id, full_name, email, mobile, relationship, custom_relationship, status
       FROM nominees
       WHERE nominee_user_id = $1 AND status = 'ACTIVE'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [nomineeUserId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      customerId: String(row.customer_id),
      nomineeUserId: row.nominee_user_id ? String(row.nominee_user_id) : null,
      fullName: String(row.full_name),
      email: row.email ? String(row.email) : null,
      mobile: row.mobile ? String(row.mobile) : null,
      relationship: String(row.relationship),
      customRelationship: row.custom_relationship ? String(row.custom_relationship) : null,
      status: String(row.status),
    };
  }

  async function queryRequests(sql: string, params: unknown[]) {
    const result = await pool.query(sql, params);
    return result.rows.map((row: Record<string, unknown>) => mapTriggerRequest(row));
  }

  function buildRequestFilterClause(filters?: TriggerRequestFilters, initialIndex = 1) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let index = initialIndex;

    if (filters?.status) {
      clauses.push(`tr.status = $${index++}`);
      params.push(filters.status);
    }

    if (filters?.requestKind) {
      clauses.push(`tr.request_kind = $${index++}`);
      params.push(filters.requestKind);
    }

    if (filters?.documentId) {
      clauses.push(`tr.document_id = $${index++}`);
      params.push(filters.documentId);
    }

    return { clauses, params };
  }

  async function findRequestByIdInternal(requestId: string) {
    const rows = await queryRequests(
      `SELECT
         tr.id,
         tr.customer_id,
         customer.full_name AS customer_full_name,
         (
           SELECT COUNT(*)
           FROM trigger_proofs p
           WHERE p.trigger_request_id = tr.id
         ) AS proof_count,
         tr.nominee_id,
         n.nominee_user_id,
         n.full_name AS nominee_full_name,
         n.email AS nominee_email,
         n.mobile AS nominee_mobile,
         n.relationship,
         n.custom_relationship,
         tr.document_id,
         d.document_title,
         ar.id AS access_rule_id,
         ar.document_id AS access_rule_document_id,
         ar.category_id AS access_rule_category_id,
         ar.can_view AS access_rule_can_view,
         ar.can_download AS access_rule_can_download,
         ar.release_condition AS access_rule_condition,
         ar.condition_notes AS access_rule_notes,
         tr.request_kind,
         tr.subject_line,
         tr.reason,
         tr.priority,
         tr.status,
         tr.submitted_at,
         tr.reviewed_at,
         tr.resolved_at,
         tr.cancelled_at,
         tr.additional_info_requested_at,
         tr.additional_info_reason,
         tr.admin_remarks,
         tr.latest_activity_at,
         tr.created_at,
         tr.updated_at,
         tr.requested_by_user_id,
         tr.last_action_by_user_id,
         u.full_name AS last_action_by_name,
         tr.last_action_role
       FROM trigger_requests tr
       INNER JOIN users customer ON customer.id = tr.customer_id
       INNER JOIN nominees n ON n.id = tr.nominee_id
       LEFT JOIN documents d ON d.id = tr.document_id
       LEFT JOIN LATERAL (
         SELECT rule.id, rule.document_id, rule.category_id, rule.can_view, rule.can_download, rule.release_condition, rule.condition_notes
         FROM document_access_rules rule
         WHERE rule.customer_id = tr.customer_id
           AND rule.nominee_id = tr.nominee_id
           AND rule.is_active = TRUE
           AND rule.deleted_at IS NULL
           AND tr.document_id IS NOT NULL
           AND (
             (rule.document_id IS NOT NULL AND rule.document_id = tr.document_id)
             OR (rule.category_id IS NOT NULL AND rule.category_id = d.category_id)
           )
         ORDER BY CASE WHEN rule.document_id = tr.document_id THEN 0 ELSE 1 END, rule.updated_at DESC
         LIMIT 1
       ) ar ON TRUE
       LEFT JOIN users u ON u.id = tr.last_action_by_user_id
       WHERE tr.id = $1
       LIMIT 1`,
      [requestId]
    );

    return rows[0] ?? null;
  }

  async function listProofsInternal(requestId: string) {
    const result = await pool.query(
      `SELECT
         p.id,
         p.trigger_request_id,
         p.uploaded_by,
         p.uploaded_by_role,
         p.proof_type,
         p.original_file_name,
         p.encrypted_file_path,
         p.file_mime_type,
         p.file_size,
         p.file_hash,
         p.notes,
         p.verification_status,
         p.admin_remarks,
         p.uploaded_at,
         u.full_name AS uploaded_by_name
       FROM trigger_proofs p
       LEFT JOIN users u ON u.id = p.uploaded_by
       WHERE p.trigger_request_id = $1
       ORDER BY p.uploaded_at DESC`,
      [requestId]
    );

    return result.rows.map((row: Record<string, unknown>) => mapTriggerProof(row));
  }

  return {
    findNomineeById,
    findNomineeByUserId,
    async listRequestsByCustomer(customerId, filters) {
      const { clauses, params } = buildRequestFilterClause(filters, 2);

      return queryRequests(
        `SELECT
           tr.id,
         tr.customer_id,
         customer.full_name AS customer_full_name,
         (
           SELECT COUNT(*)
           FROM trigger_proofs p
           WHERE p.trigger_request_id = tr.id
         ) AS proof_count,
         tr.nominee_id,
           n.nominee_user_id,
           n.full_name AS nominee_full_name,
           n.email AS nominee_email,
           n.mobile AS nominee_mobile,
           n.relationship,
           n.custom_relationship,
           tr.document_id,
           d.document_title,
           ar.id AS access_rule_id,
           ar.document_id AS access_rule_document_id,
           ar.category_id AS access_rule_category_id,
           ar.can_view AS access_rule_can_view,
           ar.can_download AS access_rule_can_download,
           ar.release_condition AS access_rule_condition,
           ar.condition_notes AS access_rule_notes,
           tr.request_kind,
           tr.subject_line,
           tr.reason,
           tr.priority,
           tr.status,
           tr.submitted_at,
           tr.reviewed_at,
           tr.resolved_at,
           tr.cancelled_at,
           tr.additional_info_requested_at,
           tr.additional_info_reason,
           tr.admin_remarks,
           tr.latest_activity_at,
           tr.created_at,
           tr.updated_at,
           tr.requested_by_user_id,
           tr.last_action_by_user_id,
           u.full_name AS last_action_by_name,
           tr.last_action_role
         FROM trigger_requests tr
         INNER JOIN users customer ON customer.id = tr.customer_id
         INNER JOIN nominees n ON n.id = tr.nominee_id
         LEFT JOIN documents d ON d.id = tr.document_id
         LEFT JOIN LATERAL (
           SELECT rule.id, rule.document_id, rule.category_id, rule.can_view, rule.can_download, rule.release_condition, rule.condition_notes
           FROM document_access_rules rule
           WHERE rule.customer_id = tr.customer_id
             AND rule.nominee_id = tr.nominee_id
             AND rule.is_active = TRUE
             AND rule.deleted_at IS NULL
             AND tr.document_id IS NOT NULL
             AND (
               (rule.document_id IS NOT NULL AND rule.document_id = tr.document_id)
               OR (rule.category_id IS NOT NULL AND rule.category_id = d.category_id)
             )
           ORDER BY CASE WHEN rule.document_id = tr.document_id THEN 0 ELSE 1 END, rule.updated_at DESC
           LIMIT 1
         ) ar ON TRUE
         LEFT JOIN users u ON u.id = tr.last_action_by_user_id
         WHERE tr.customer_id = $1 ${clauses.length ? `AND ${clauses.join(" AND ")}` : ""}
         ORDER BY tr.latest_activity_at DESC, tr.created_at DESC`,
        [customerId, ...params]
      );
    },
    async listRequestsByNomineeUserId(nomineeUserId, filters) {
      const { clauses, params } = buildRequestFilterClause(filters, 2);

      return queryRequests(
        `SELECT
           tr.id,
          tr.customer_id,
          customer.full_name AS customer_full_name,
          (
            SELECT COUNT(*)
            FROM trigger_proofs p
            WHERE p.trigger_request_id = tr.id
          ) AS proof_count,
          tr.nominee_id,
           n.nominee_user_id,
           n.full_name AS nominee_full_name,
           n.email AS nominee_email,
           n.mobile AS nominee_mobile,
           n.relationship,
           n.custom_relationship,
           tr.document_id,
           d.document_title,
           ar.id AS access_rule_id,
           ar.document_id AS access_rule_document_id,
           ar.category_id AS access_rule_category_id,
           ar.can_view AS access_rule_can_view,
           ar.can_download AS access_rule_can_download,
           ar.release_condition AS access_rule_condition,
           ar.condition_notes AS access_rule_notes,
           tr.request_kind,
           tr.subject_line,
           tr.reason,
           tr.priority,
           tr.status,
           tr.submitted_at,
           tr.reviewed_at,
           tr.resolved_at,
           tr.cancelled_at,
           tr.additional_info_requested_at,
           tr.additional_info_reason,
           tr.admin_remarks,
           tr.latest_activity_at,
           tr.created_at,
           tr.updated_at,
           tr.requested_by_user_id,
           tr.last_action_by_user_id,
           u.full_name AS last_action_by_name,
           tr.last_action_role
         FROM trigger_requests tr
         INNER JOIN users customer ON customer.id = tr.customer_id
         INNER JOIN nominees n ON n.id = tr.nominee_id
         LEFT JOIN documents d ON d.id = tr.document_id
         LEFT JOIN LATERAL (
           SELECT rule.id, rule.document_id, rule.category_id, rule.can_view, rule.can_download, rule.release_condition, rule.condition_notes
           FROM document_access_rules rule
           WHERE rule.customer_id = tr.customer_id
             AND rule.nominee_id = tr.nominee_id
             AND rule.is_active = TRUE
             AND rule.deleted_at IS NULL
             AND tr.document_id IS NOT NULL
             AND (
               (rule.document_id IS NOT NULL AND rule.document_id = tr.document_id)
               OR (rule.category_id IS NOT NULL AND rule.category_id = d.category_id)
             )
           ORDER BY CASE WHEN rule.document_id = tr.document_id THEN 0 ELSE 1 END, rule.updated_at DESC
           LIMIT 1
         ) ar ON TRUE
         LEFT JOIN users u ON u.id = tr.last_action_by_user_id
         WHERE n.nominee_user_id = $1 ${clauses.length ? `AND ${clauses.join(" AND ")}` : ""}
         ORDER BY tr.latest_activity_at DESC, tr.created_at DESC`,
        [nomineeUserId, ...params]
      );
    },
    async listRequestsForAdmin(filters) {
      const { clauses, params } = buildRequestFilterClause(filters, 1);
      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      return queryRequests(
        `SELECT
           tr.id,
           tr.customer_id,
           customer.full_name AS customer_full_name,
           (
             SELECT COUNT(*)
             FROM trigger_proofs p
             WHERE p.trigger_request_id = tr.id
           ) AS proof_count,
           tr.nominee_id,
           n.nominee_user_id,
           n.full_name AS nominee_full_name,
           n.email AS nominee_email,
           n.mobile AS nominee_mobile,
           n.relationship,
           n.custom_relationship,
           tr.document_id,
           d.document_title,
           ar.id AS access_rule_id,
           ar.document_id AS access_rule_document_id,
           ar.category_id AS access_rule_category_id,
           ar.can_view AS access_rule_can_view,
           ar.can_download AS access_rule_can_download,
           ar.release_condition AS access_rule_condition,
           ar.condition_notes AS access_rule_notes,
           tr.request_kind,
           tr.subject_line,
           tr.reason,
           tr.priority,
           tr.status,
           tr.submitted_at,
           tr.reviewed_at,
           tr.resolved_at,
           tr.cancelled_at,
           tr.additional_info_requested_at,
           tr.additional_info_reason,
           tr.admin_remarks,
           tr.latest_activity_at,
           tr.created_at,
           tr.updated_at,
           tr.requested_by_user_id,
           tr.last_action_by_user_id,
           u.full_name AS last_action_by_name,
           tr.last_action_role
         FROM trigger_requests tr
         INNER JOIN users customer ON customer.id = tr.customer_id
         INNER JOIN nominees n ON n.id = tr.nominee_id
         LEFT JOIN documents d ON d.id = tr.document_id
         LEFT JOIN LATERAL (
           SELECT rule.id, rule.document_id, rule.category_id, rule.can_view, rule.can_download, rule.release_condition, rule.condition_notes
           FROM document_access_rules rule
           WHERE rule.customer_id = tr.customer_id
             AND rule.nominee_id = tr.nominee_id
             AND rule.is_active = TRUE
             AND rule.deleted_at IS NULL
             AND tr.document_id IS NOT NULL
             AND (
               (rule.document_id IS NOT NULL AND rule.document_id = tr.document_id)
               OR (rule.category_id IS NOT NULL AND rule.category_id = d.category_id)
             )
           ORDER BY CASE WHEN rule.document_id = tr.document_id THEN 0 ELSE 1 END, rule.updated_at DESC
           LIMIT 1
         ) ar ON TRUE
         LEFT JOIN users u ON u.id = tr.last_action_by_user_id
         ${whereClause}
         ORDER BY tr.latest_activity_at DESC, tr.created_at DESC`,
        params
      );
    },
    async findRequestById(requestId) {
      return findRequestByIdInternal(requestId);
    },
    async createRequest(input) {
      const result = await pool.query(
        `INSERT INTO trigger_requests
          (customer_id, nominee_id, document_id, requested_by_user_id, trigger_type, request_kind, subject_line, reason, priority, status, latest_activity_at, last_action_by_user_id, last_action_role)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, 'DRAFT', CURRENT_TIMESTAMP, $4, $9)
         RETURNING id`,
        [
          input.customerId,
          input.nomineeId,
          input.documentId,
          input.requestedByUserId,
          input.requestKind,
          input.subjectLine,
          input.summary,
          input.priority,
          input.requestedByRole.toLowerCase(),
        ]
      );

      const request = await findRequestByIdInternal(String(result.rows[0].id));
      if (!request) {
        throw new Error("Failed to create trigger request.");
      }

      return request;
    },
    async submitRequest(requestId, actorUserId, actorRole) {
      const result = await pool.query(
        `UPDATE trigger_requests
         SET status = 'PENDING',
             submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
             latest_activity_at = CURRENT_TIMESTAMP,
             last_action_by_user_id = $2,
             last_action_role = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status IN ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED')
         RETURNING id`,
        [requestId, actorUserId, actorRole]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findRequestByIdInternal(requestId);
    },
    async updateRequestStatus(requestId, status, actorUserId, actorRole) {
      const result = await pool.query(
        `UPDATE trigger_requests
         SET status = $2,
             latest_activity_at = CURRENT_TIMESTAMP,
             last_action_by_user_id = $3,
             last_action_role = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id`,
        [requestId, status, actorUserId, actorRole]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findRequestByIdInternal(requestId);
    },
    async createProof(input) {
      const result = await pool.query(
        `INSERT INTO trigger_proofs
          (trigger_request_id, uploaded_by, uploaded_by_role, proof_type, original_file_name, encrypted_file_path, file_mime_type, file_size, file_hash, notes, verification_status, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'UPLOADED', CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          input.triggerRequestId,
          input.uploadedByUserId,
          input.uploadedByRole,
          "SUPPORTING_PROOF",
          input.fileName,
          input.encryptedFilePath,
          input.fileMimeType,
          input.fileSize,
          input.fileHash,
          input.notes,
        ]
      );

      const proofResult = await pool.query(
        `SELECT
           p.id,
           p.trigger_request_id,
           p.uploaded_by,
           p.uploaded_by_role,
           p.proof_type,
           p.original_file_name,
           p.encrypted_file_path,
           p.file_mime_type,
           p.file_size,
           p.file_hash,
           p.notes,
           p.verification_status,
           p.admin_remarks,
           p.uploaded_at,
           u.full_name AS uploaded_by_name
         FROM trigger_proofs p
         LEFT JOIN users u ON u.id = p.uploaded_by
         WHERE p.id = $1
         LIMIT 1`,
        [String(result.rows[0].id)]
      );

      return mapTriggerProof(proofResult.rows[0] as Record<string, unknown>);
    },
    async listProofs(requestId) {
      return listProofsInternal(requestId);
    },
    async findProofById(requestId, proofId) {
      const result = await pool.query(
        `SELECT original_file_name, encrypted_file_path
         FROM trigger_proofs
         WHERE trigger_request_id = $1 AND id = $2
         LIMIT 1`,
        [requestId, proofId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0] as Record<string, unknown>;
      return {
        originalFileName: row.original_file_name ? String(row.original_file_name) : null,
        encryptedFilePath: String(row.encrypted_file_path),
      };
    },
    async deleteUnreviewedProof(requestId, proofId) {
      const result = await pool.query(
        `DELETE FROM trigger_proofs
         WHERE trigger_request_id = $1 AND id = $2 AND verification_status = 'UPLOADED'
         RETURNING encrypted_file_path`,
        [requestId, proofId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return {
        encryptedFilePath: String((result.rows[0] as Record<string, unknown>).encrypted_file_path),
      };
    },
    async updateProofVerification(requestId, proofId, verificationStatus, adminUserId, adminRemarks) {
      const result = await pool.query(
        `UPDATE trigger_proofs
         SET verification_status = $3,
             admin_remarks = $4,
             verified_by = $5,
             verified_at = CURRENT_TIMESTAMP
         WHERE trigger_request_id = $1 AND id = $2
         RETURNING id`,
        [requestId, proofId, verificationStatus, adminRemarks, adminUserId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const proofResult = await pool.query(
        `SELECT
           p.id,
           p.trigger_request_id,
           p.uploaded_by,
           p.uploaded_by_role,
           p.proof_type,
           p.original_file_name,
           p.encrypted_file_path,
           p.file_mime_type,
           p.file_size,
           p.file_hash,
           p.notes,
           p.verification_status,
           p.admin_remarks,
           p.uploaded_at,
           u.full_name AS uploaded_by_name
         FROM trigger_proofs p
         LEFT JOIN users u ON u.id = p.uploaded_by
         WHERE p.id = $1
         LIMIT 1`,
        [proofId]
      );

      return proofResult.rows[0] ? mapTriggerProof(proofResult.rows[0] as Record<string, unknown>) : null;
    },
    async updateRequestReview(requestId, status, actorUserId, actorRole, adminRemarks, additionalInfoReason) {
      const result = await pool.query(
        `UPDATE trigger_requests
         SET status = $2::trigger_status,
             admin_remarks = COALESCE($3, admin_remarks),
             additional_info_reason = COALESCE($4, additional_info_reason),
             reviewed_by = $5,
             reviewed_at = CURRENT_TIMESTAMP,
             resolved_at = CASE WHEN $2::text IN ('APPROVED', 'REJECTED') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
             latest_activity_at = CURRENT_TIMESTAMP,
             last_action_by_user_id = $5,
             last_action_role = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id`,
        [requestId, status, adminRemarks, additionalInfoReason ?? null, actorUserId, actorRole]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findRequestByIdInternal(requestId);
    },
    async createVerificationNote(requestId, adminUserId, note) {
      await pool.query(
        `INSERT INTO verification_notes (trigger_request_id, admin_id, note)
         VALUES ($1, $2, $3)`,
        [requestId, adminUserId, note]
      );
    },
    async listTimeline(requestId) {
      const request = await findRequestByIdInternal(requestId);
      if (!request) {
        return [];
      }

      const proofs = await listProofsInternal(requestId);
      const timeline: TriggerTimelineEntry[] = [];

      timeline.push({
        id: `timeline-${request.id}-created`,
        requestId: request.id,
        action: "Request created",
        status: "DRAFT",
        actorName: request.lastActionByName ?? request.nomineeName,
        actorRole: request.lastActionRole,
        summary: request.summary || "Trigger request prepared for review.",
        createdAt: request.createdAt,
      });

      if (request.submittedAt) {
        timeline.push({
          id: `timeline-${request.id}-submitted`,
          requestId: request.id,
          action: "Request submitted",
          status: "PENDING",
          actorName: request.lastActionByName ?? request.nomineeName,
          actorRole: request.lastActionRole,
          summary: "The trigger request entered the pending review queue.",
          createdAt: request.submittedAt,
        });
      }

      for (const proof of proofs) {
        timeline.push({
          id: `timeline-${proof.id}-proof`,
          requestId: request.id,
          action: "Proof uploaded",
          status: request.status === "ADDITIONAL_INFO_REQUIRED" ? "ADDITIONAL_INFO_REQUIRED" : "UNDER_REVIEW",
          actorName: proof.uploadedBy ?? request.nomineeName,
          actorRole: proof.uploadedByRole,
          summary: proof.notes ?? "Supporting proof uploaded.",
          createdAt: proof.createdAt,
        });
      }

      const proofReviewResult = await pool.query(
        `SELECT
           p.id,
           p.original_file_name,
           p.verification_status,
           p.admin_remarks,
           p.verified_at,
           u.full_name AS verified_by_name
         FROM trigger_proofs p
         LEFT JOIN users u ON u.id = p.verified_by
         WHERE p.trigger_request_id = $1 AND p.verified_at IS NOT NULL
         ORDER BY p.verified_at ASC`,
        [requestId]
      );

      for (const row of proofReviewResult.rows as Array<Record<string, unknown>>) {
        const verificationStatus = String(row.verification_status);
        const reviewedAt = toIso(row.verified_at as NullableDate);
        if (!reviewedAt) {
          continue;
        }

        timeline.push({
          id: `timeline-${String(row.id)}-proof-review`,
          requestId: request.id,
          action: verificationStatus === "VERIFIED" ? "Proof verified" : "Proof rejected",
          status: request.status === "APPROVED" || request.status === "REJECTED" ? request.status : "UNDER_REVIEW",
          actorName: row.verified_by_name ? String(row.verified_by_name) : "Verification officer",
          actorRole: "admin",
          summary:
            row.admin_remarks
              ? String(row.admin_remarks)
              : `${String(row.original_file_name ?? "Proof")} marked ${verificationStatus.toLowerCase()}.`,
          createdAt: reviewedAt,
        });
      }

      if (request.additionalInfoRequestedAt) {
        timeline.push({
          id: `timeline-${request.id}-more-info`,
          requestId: request.id,
          action: "More information requested",
          status: "ADDITIONAL_INFO_REQUIRED",
          actorName: request.lastActionByName ?? "Verification officer",
          actorRole: "admin",
          summary: request.additionalInfoReason ?? "The officer requested more information before making a final decision.",
          createdAt: request.additionalInfoRequestedAt,
        });
      }

      if (request.resolvedAt && (request.status === "APPROVED" || request.status === "REJECTED")) {
        timeline.push({
          id: `timeline-${request.id}-${request.status.toLowerCase()}`,
          requestId: request.id,
          action: request.status === "APPROVED" ? "Request approved" : "Request rejected",
          status: request.status,
          actorName: request.lastActionByName ?? "Verification officer",
          actorRole: "admin",
          summary:
            request.adminDecisionNote ??
            (request.status === "APPROVED"
              ? "The trigger request was approved after proof review."
              : "The trigger request was rejected after proof review."),
          createdAt: request.resolvedAt,
        });
      }

      return timeline.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },
  };
}
