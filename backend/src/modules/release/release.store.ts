import type { Pool } from "pg";

import type {
  ReleaseDocumentCandidate,
  ReleaseNotificationRecord,
  ReleaseProofRecord,
  ReleaseQueueSummary,
  ReleaseRecord,
  ReleaseRequestRecord,
  ReleasedDocumentAccessLogRecord,
} from "./types.js";
import type { TriggerRequestKind, TriggerRequestPriority, TriggerRequestStatus } from "../trigger/types.js";
import type { TriggerActorRole } from "../trigger/types.js";

function toIso(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRequest(row: Record<string, unknown>): ReleaseRequestRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    nomineeId: String(row.nominee_id),
    nomineeUserId: row.nominee_user_id ? String(row.nominee_user_id) : null,
    nomineeName: String(row.nominee_full_name),
    nomineeEmail: row.nominee_email ? String(row.nominee_email) : null,
    relationship: String(row.relationship),
    customRelationship: row.custom_relationship ? String(row.custom_relationship) : null,
    requestKind: String(row.request_kind) as TriggerRequestKind,
    subjectLine: String(row.subject_line),
    summary: String(row.reason ?? ""),
    priority: String(row.priority) as TriggerRequestPriority,
    status: String(row.status) as TriggerRequestStatus,
    reviewedAt: toIso(row.reviewed_at as string | Date | null),
    resolvedAt: toIso(row.resolved_at as string | Date | null),
    latestActivityAt: toIso(row.latest_activity_at as string | Date | null) ?? new Date().toISOString(),
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function mapProof(row: Record<string, unknown>): ReleaseProofRecord {
  return {
    id: String(row.id),
    requestId: String(row.trigger_request_id),
    fileName: String(row.original_file_name ?? "proof"),
    fileType: String(row.file_mime_type ?? "application/octet-stream"),
    fileSize: Number(row.file_size ?? 0),
    notes: row.notes ? String(row.notes) : null,
    verificationStatus: String(row.verification_status) as ReleaseProofRecord["verificationStatus"],
    adminRemarks: row.admin_remarks ? String(row.admin_remarks) : null,
    uploadedBy: row.uploaded_by_name ? String(row.uploaded_by_name) : null,
    uploadedByRole: String(row.uploaded_by_role) as TriggerActorRole,
    createdAt: toIso(row.uploaded_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function mapRelease(row: Record<string, unknown>): ReleaseRecord {
  const canView = Boolean(row.can_view);
  return {
    id: String(row.id),
    triggerRequestId: String(row.trigger_request_id),
    customerId: String(row.customer_id),
    nomineeId: String(row.nominee_id),
    nomineeName: String(row.nominee_full_name),
    nomineeUserId: row.nominee_user_id ? String(row.nominee_user_id) : null,
    documentId: String(row.document_id),
    documentTitle: String(row.document_title),
    fileName: row.original_file_name ? String(row.original_file_name) : null,
    fileType: row.file_mime_type ? String(row.file_mime_type) : null,
    fileSize: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    canView,
    canDownload: canView && Boolean(row.can_download),
    releaseStatus: String(row.release_status) as ReleaseRecord["releaseStatus"],
    releaseNotes: row.release_notes ? String(row.release_notes) : null,
    releasedBy: row.released_by_name ? String(row.released_by_name) : null,
    releasedAt: toIso(row.released_at as string | Date | null),
    revokedAt: toIso(row.revoked_at as string | Date | null),
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function mapAccessLog(row: Record<string, unknown>): ReleasedDocumentAccessLogRecord {
  return {
    id: String(row.id),
    releaseId: String(row.release_id),
    triggerRequestId: String(row.trigger_request_id),
    customerId: String(row.customer_id),
    nomineeId: String(row.nominee_id),
    documentId: String(row.document_id),
    documentTitle: String(row.document_title),
    action: String(row.action) as ReleasedDocumentAccessLogRecord["action"],
    actorName: row.actor_name ? String(row.actor_name) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    deviceInfo: row.device_info ? String(row.device_info) : null,
    accessedAt: toIso(row.accessed_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function mapNotification(row: Record<string, unknown>): ReleaseNotificationRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    message: String(row.message),
    channel: String(row.channel) as ReleaseNotificationRecord["channel"],
    status: String(row.status) as ReleaseNotificationRecord["status"],
    readAt: toIso(row.read_at as string | Date | null),
    sentAt: toIso(row.sent_at as string | Date | null),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
  };
}

export type ReleaseStore = {
  listApprovedRequests(): Promise<ReleaseRequestRecord[]>;
  findApprovedRequestById(requestId: string): Promise<ReleaseRequestRecord | null>;
  listEligibleDocuments(requestId: string): Promise<ReleaseDocumentCandidate[]>;
  listReleasesByRequestId(requestId: string): Promise<ReleaseRecord[]>;
  listReleasesForAdmin(): Promise<ReleaseRecord[]>;
  findReleaseById(releaseId: string): Promise<ReleaseRecord | null>;
  findReleaseAccessContext(releaseId: string): Promise<{ release: ReleaseRecord; encryptedFilePath: string } | null>;
  findReleaseByComposite(input: { triggerRequestId: string; documentId: string; nomineeId: string }): Promise<ReleaseRecord | null>;
  findReleaseAccessContextByComposite(input: { triggerRequestId: string; documentId: string; nomineeId: string }): Promise<{ release: ReleaseRecord; encryptedFilePath: string } | null>;
  upsertRelease(input: {
    triggerRequestId: string;
    customerId: string;
    nomineeId: string;
    documentId: string;
    releasedBy: string;
    canView: boolean;
    canDownload: boolean;
    releaseNotes: string | null;
  }): Promise<ReleaseRecord>;
  revokeRelease(releaseId: string, revokedBy: string, notes: string | null): Promise<ReleaseRecord | null>;
  listReleasedDocumentsForNominee(nomineeUserId: string): Promise<ReleaseRecord[]>;
  listAccessLogsForNominee(nomineeUserId: string): Promise<ReleasedDocumentAccessLogRecord[]>;
  createAccessLog(input: {
    releaseId: string;
    nomineeId: string;
    documentId: string;
    documentTitle: string;
    action: ReleasedDocumentAccessLogRecord["action"];
    actorName: string | null;
    ipAddress: string | null;
    deviceInfo: string | null;
  }): Promise<void>;
  listNotificationsForUser(userId: string): Promise<ReleaseNotificationRecord[]>;
  listAccessLogsForAdmin(): Promise<ReleasedDocumentAccessLogRecord[]>;
  createNotification(input: {
    userId: string;
    title: string;
    message: string;
    channel?: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
    status?: "PENDING" | "SENT" | "FAILED";
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  listReleaseQueueSummaries(): Promise<ReleaseQueueSummary[]>;
  listProofs(requestId: string): Promise<ReleaseProofRecord[]>;
};

export function createPostgresReleaseStore(pool: Pool): ReleaseStore {
  async function queryRequestRows(sql: string, params: unknown[] = []) {
    const result = await pool.query(sql, params);
    return result.rows.map((row: Record<string, unknown>) => mapRequest(row));
  }

  async function listEligibleDocumentsInternal(requestId: string) {
    const result = await pool.query(
      `SELECT
         d.id AS document_id,
         d.document_title,
         d.original_file_name,
         d.file_mime_type,
         d.file_size,
         d.category_id,
         c.category_name,
         ar.can_view,
         ar.can_download,
         ar.release_condition,
         ar.condition_notes,
         dr.id AS release_id,
         dr.release_status,
         dr.release_notes,
         dr.released_at,
         dr.revoked_at,
         dr.updated_at
       FROM trigger_requests tr
       INNER JOIN nominees n ON n.id = tr.nominee_id
       INNER JOIN documents d ON d.customer_id = tr.customer_id
       INNER JOIN document_categories c ON c.id = d.category_id
       INNER JOIN LATERAL (
         SELECT rule.can_view, rule.can_download, rule.release_condition, rule.condition_notes
         FROM document_access_rules rule
         WHERE rule.customer_id = tr.customer_id
           AND rule.nominee_id = n.id
           AND rule.is_active = TRUE
           AND rule.deleted_at IS NULL
           AND (
             (rule.document_id IS NOT NULL AND rule.document_id = d.id)
             OR (rule.category_id IS NOT NULL AND rule.category_id = d.category_id)
           )
         ORDER BY CASE WHEN rule.document_id = d.id THEN 0 ELSE 1 END, rule.updated_at DESC
         LIMIT 1
       ) ar ON TRUE
       LEFT JOIN document_releases dr
         ON dr.trigger_request_id = tr.id
        AND dr.nominee_id = n.id
        AND dr.document_id = d.id
       WHERE tr.id = $1
         AND d.status = 'ACTIVE'
         AND (tr.document_id IS NULL OR tr.document_id = d.id)
       ORDER BY d.document_title ASC`,
      [requestId]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      documentId: String(row.document_id),
      documentTitle: String(row.document_title),
      fileName: row.original_file_name ? String(row.original_file_name) : null,
      fileType: row.file_mime_type ? String(row.file_mime_type) : null,
      fileSize: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
      categoryId: String(row.category_id),
      categoryName: String(row.category_name),
      canView: Boolean(row.can_view),
      canDownload: Boolean(row.can_view) && Boolean(row.can_download),
      releaseCondition: row.release_condition ? String(row.release_condition) : null,
      conditionNotes: row.condition_notes ? String(row.condition_notes) : null,
      releaseId: row.release_id ? String(row.release_id) : null,
      releaseStatus: String(row.release_status ?? "PENDING") as ReleaseDocumentCandidate["releaseStatus"],
      releaseNotes: row.release_notes ? String(row.release_notes) : null,
      releasedAt: toIso(row.released_at as string | Date | null),
      revokedAt: toIso(row.revoked_at as string | Date | null),
      updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
    }));
  }

  return {
    async listApprovedRequests() {
      return queryRequestRows(
        `SELECT
           tr.id,
           tr.customer_id,
           tr.nominee_id,
           n.nominee_user_id,
           n.full_name AS nominee_full_name,
           n.email AS nominee_email,
           n.relationship,
           n.custom_relationship,
           tr.request_kind,
           tr.subject_line,
           tr.reason,
           tr.priority,
           tr.status,
           tr.reviewed_at,
           tr.resolved_at,
           tr.latest_activity_at,
           tr.created_at,
           tr.updated_at
         FROM trigger_requests tr
         INNER JOIN nominees n ON n.id = tr.nominee_id
         WHERE tr.status = 'APPROVED'
         ORDER BY tr.latest_activity_at DESC, tr.created_at DESC`
      );
    },
    async findApprovedRequestById(requestId) {
      const rows = await queryRequestRows(
        `SELECT
           tr.id,
           tr.customer_id,
           tr.nominee_id,
           n.nominee_user_id,
           n.full_name AS nominee_full_name,
           n.email AS nominee_email,
           n.relationship,
           n.custom_relationship,
           tr.request_kind,
           tr.subject_line,
           tr.reason,
           tr.priority,
           tr.status,
           tr.reviewed_at,
           tr.resolved_at,
           tr.latest_activity_at,
           tr.created_at,
           tr.updated_at
         FROM trigger_requests tr
         INNER JOIN nominees n ON n.id = tr.nominee_id
         WHERE tr.id = $1 AND tr.status = 'APPROVED'
         LIMIT 1`,
        [requestId]
      );
      return rows[0] ?? null;
    },
    async listEligibleDocuments(requestId) {
      return listEligibleDocumentsInternal(requestId);
    },
    async listReleasesByRequestId(requestId) {
      const result = await pool.query(
        `SELECT
           dr.id,
           dr.trigger_request_id,
           dr.customer_id,
           dr.nominee_id,
           n.full_name AS nominee_full_name,
           n.nominee_user_id,
           dr.document_id,
           d.document_title,
           d.original_file_name,
           d.file_mime_type,
           d.file_size,
           d.category_id,
           c.category_name,
           dr.released_by,
           u.full_name AS released_by_name,
           dr.release_status,
           dr.can_view,
           dr.can_download,
           dr.release_notes,
           dr.released_at,
           dr.revoked_at,
           dr.created_at,
           dr.updated_at
         FROM document_releases dr
         INNER JOIN nominees n ON n.id = dr.nominee_id
         INNER JOIN documents d ON d.id = dr.document_id
         INNER JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN users u ON u.id = dr.released_by
         WHERE dr.trigger_request_id = $1
         ORDER BY dr.updated_at DESC`,
        [requestId]
      );
      return result.rows.map((row: Record<string, unknown>) => mapRelease(row));
    },
    async listReleasesForAdmin() {
      const result = await pool.query(
        `SELECT
           dr.id,
           dr.trigger_request_id,
           dr.customer_id,
           dr.nominee_id,
           n.full_name AS nominee_full_name,
           n.nominee_user_id,
           dr.document_id,
           d.document_title,
           d.original_file_name,
           d.file_mime_type,
           d.file_size,
           d.category_id,
           c.category_name,
           dr.released_by,
           u.full_name AS released_by_name,
           dr.release_status,
           dr.can_view,
           dr.can_download,
           dr.release_notes,
           dr.released_at,
           dr.revoked_at,
           dr.created_at,
           dr.updated_at
         FROM document_releases dr
         INNER JOIN nominees n ON n.id = dr.nominee_id
         INNER JOIN documents d ON d.id = dr.document_id
         INNER JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN users u ON u.id = dr.released_by
         ORDER BY dr.updated_at DESC, dr.created_at DESC`
      );
      return result.rows.map((row: Record<string, unknown>) => mapRelease(row));
    },
    async findReleaseById(releaseId) {
      const result = await pool.query(
        `SELECT
           dr.id,
           dr.trigger_request_id,
           dr.customer_id,
           dr.nominee_id,
           n.full_name AS nominee_full_name,
           n.nominee_user_id,
           dr.document_id,
           d.document_title,
           d.original_file_name,
           d.file_mime_type,
           d.file_size,
           d.category_id,
           c.category_name,
           dr.released_by,
           u.full_name AS released_by_name,
           dr.release_status,
           dr.can_view,
           dr.can_download,
           dr.release_notes,
           dr.released_at,
           dr.revoked_at,
           dr.created_at,
           dr.updated_at
         FROM document_releases dr
         INNER JOIN nominees n ON n.id = dr.nominee_id
         INNER JOIN documents d ON d.id = dr.document_id
         INNER JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN users u ON u.id = dr.released_by
         WHERE dr.id = $1
         LIMIT 1`,
        [releaseId]
      );
      return result.rows[0] ? mapRelease(result.rows[0] as Record<string, unknown>) : null;
    },
    async findReleaseAccessContext(releaseId) {
      const result = await pool.query(
        `SELECT
           dr.id,
           dr.trigger_request_id,
           dr.customer_id,
           dr.nominee_id,
           n.full_name AS nominee_full_name,
           n.nominee_user_id,
           dr.document_id,
           d.document_title,
           d.original_file_name,
           d.file_mime_type,
           d.file_size,
           d.category_id,
           c.category_name,
           dr.released_by,
           u.full_name AS released_by_name,
           dr.release_status,
           dr.can_view,
           dr.can_download,
           dr.release_notes,
           dr.released_at,
           dr.revoked_at,
           dr.created_at,
           dr.updated_at,
           d.encrypted_file_path
         FROM document_releases dr
         INNER JOIN nominees n ON n.id = dr.nominee_id
         INNER JOIN documents d ON d.id = dr.document_id
         INNER JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN users u ON u.id = dr.released_by
         WHERE dr.id = $1
         LIMIT 1`,
        [releaseId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0] as Record<string, unknown>;
      return {
        release: mapRelease(row),
        encryptedFilePath: String(row.encrypted_file_path),
      };
    },
    async findReleaseByComposite(input) {
      const result = await pool.query(
        `SELECT
           dr.id,
           dr.trigger_request_id,
           dr.customer_id,
           dr.nominee_id,
           n.full_name AS nominee_full_name,
           n.nominee_user_id,
           dr.document_id,
           d.document_title,
           d.original_file_name,
           d.file_mime_type,
           d.file_size,
           d.category_id,
           c.category_name,
           dr.released_by,
           u.full_name AS released_by_name,
           dr.release_status,
           dr.can_view,
           dr.can_download,
           dr.release_notes,
           dr.released_at,
           dr.revoked_at,
           dr.created_at,
           dr.updated_at
         FROM document_releases dr
         INNER JOIN nominees n ON n.id = dr.nominee_id
         INNER JOIN documents d ON d.id = dr.document_id
         INNER JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN users u ON u.id = dr.released_by
         WHERE dr.trigger_request_id = $1 AND dr.document_id = $2 AND dr.nominee_id = $3
         LIMIT 1`,
        [input.triggerRequestId, input.documentId, input.nomineeId]
      );
      return result.rows[0] ? mapRelease(result.rows[0] as Record<string, unknown>) : null;
    },
    async findReleaseAccessContextByComposite(input) {
      const result = await pool.query(
        `SELECT
           dr.id,
           dr.trigger_request_id,
           dr.customer_id,
           dr.nominee_id,
           n.full_name AS nominee_full_name,
           n.nominee_user_id,
           dr.document_id,
           d.document_title,
           d.original_file_name,
           d.file_mime_type,
           d.file_size,
           d.category_id,
           c.category_name,
           dr.released_by,
           u.full_name AS released_by_name,
           dr.release_status,
           dr.can_view,
           dr.can_download,
           dr.release_notes,
           dr.released_at,
           dr.revoked_at,
           dr.created_at,
           dr.updated_at,
           d.encrypted_file_path
         FROM document_releases dr
         INNER JOIN nominees n ON n.id = dr.nominee_id
         INNER JOIN documents d ON d.id = dr.document_id
         INNER JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN users u ON u.id = dr.released_by
         WHERE dr.trigger_request_id = $1 AND dr.document_id = $2 AND dr.nominee_id = $3
         LIMIT 1`,
        [input.triggerRequestId, input.documentId, input.nomineeId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0] as Record<string, unknown>;
      return {
        release: mapRelease(row),
        encryptedFilePath: String(row.encrypted_file_path),
      };
    },
    async upsertRelease(input) {
      const result = await pool.query(
        `INSERT INTO document_releases
           (trigger_request_id, customer_id, nominee_id, document_id, released_by, release_status, can_view, can_download, release_notes, released_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'RELEASED', $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (trigger_request_id, nominee_id, document_id)
         DO UPDATE SET
           released_by = EXCLUDED.released_by,
           release_status = 'RELEASED',
           can_view = EXCLUDED.can_view,
           can_download = EXCLUDED.can_download,
           release_notes = EXCLUDED.release_notes,
           released_at = COALESCE(document_releases.released_at, CURRENT_TIMESTAMP),
           revoked_at = NULL,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          input.triggerRequestId,
          input.customerId,
          input.nomineeId,
          input.documentId,
          input.releasedBy,
          input.canView,
          input.canDownload,
          input.releaseNotes,
        ]
      );

      const release = await this.findReleaseById(String(result.rows[0].id));
      if (!release) {
        throw new Error("Unable to create release.");
      }

      return release;
    },
    async revokeRelease(releaseId, revokedBy, notes) {
      const result = await pool.query(
        `UPDATE document_releases
         SET release_status = 'REVOKED',
             revoked_at = CURRENT_TIMESTAMP,
             release_notes = COALESCE($3, release_notes),
             released_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id`,
        [releaseId, revokedBy, notes]
      );

      if (!result.rows[0]) {
        return null;
      }

      return this.findReleaseById(releaseId);
    },
    async listReleasedDocumentsForNominee(nomineeUserId) {
      const result = await pool.query(
        `SELECT
           dr.id,
           dr.trigger_request_id,
           dr.customer_id,
           dr.nominee_id,
           n.full_name AS nominee_full_name,
           n.nominee_user_id,
           dr.document_id,
           d.document_title,
           d.original_file_name,
           d.file_mime_type,
           d.file_size,
           d.category_id,
           c.category_name,
           dr.released_by,
           u.full_name AS released_by_name,
           dr.release_status,
           dr.can_view,
           dr.can_download,
           dr.release_notes,
           dr.released_at,
           dr.revoked_at,
           dr.created_at,
           dr.updated_at
         FROM document_releases dr
         INNER JOIN nominees n ON n.id = dr.nominee_id
         INNER JOIN documents d ON d.id = dr.document_id
         INNER JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN users u ON u.id = dr.released_by
         WHERE n.nominee_user_id = $1 AND dr.release_status = 'RELEASED' AND d.status = 'ACTIVE'
         ORDER BY dr.updated_at DESC`,
        [nomineeUserId]
      );
      return result.rows.map((row: Record<string, unknown>) => mapRelease(row));
    },
    async listAccessLogsForNominee(nomineeUserId) {
      const result = await pool.query(
        `SELECT
           l.id,
           l.release_id,
           dr.trigger_request_id,
           dr.customer_id,
           l.nominee_id,
           l.document_id,
           d.document_title,
           l.action,
           n.full_name AS actor_name,
           l.ip_address,
           l.device_info,
           l.accessed_at
         FROM released_document_access_logs l
         INNER JOIN document_releases dr ON dr.id = l.release_id
         INNER JOIN nominees n ON n.id = l.nominee_id
         INNER JOIN documents d ON d.id = l.document_id
         WHERE n.nominee_user_id = $1
         ORDER BY l.accessed_at DESC`,
        [nomineeUserId]
      );
      return result.rows.map((row: Record<string, unknown>) => mapAccessLog(row));
    },
    async listAccessLogsForAdmin() {
      const result = await pool.query(
        `SELECT
           l.id,
           l.release_id,
           dr.trigger_request_id,
           dr.customer_id,
           l.nominee_id,
           l.document_id,
           d.document_title,
           l.action,
           n.full_name AS actor_name,
           l.ip_address,
           l.device_info,
           l.accessed_at
         FROM released_document_access_logs l
         INNER JOIN document_releases dr ON dr.id = l.release_id
         INNER JOIN nominees n ON n.id = l.nominee_id
         INNER JOIN documents d ON d.id = l.document_id
         ORDER BY l.accessed_at DESC`
      );
      return result.rows.map((row: Record<string, unknown>) => mapAccessLog(row));
    },
    async createAccessLog(input) {
      await pool.query(
        `INSERT INTO released_document_access_logs
           (release_id, nominee_id, document_id, action, ip_address, device_info, accessed_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [input.releaseId, input.nomineeId, input.documentId, input.action, input.ipAddress, input.deviceInfo]
      );
    },
    async listNotificationsForUser(userId) {
      const result = await pool.query(
        `SELECT id, user_id, title, message, channel, status, read_at, sent_at, metadata, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows.map((row: Record<string, unknown>) => mapNotification(row));
    },
    async createNotification(input) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, channel, status, sent_at, metadata)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
        [
          input.userId,
          input.title,
          input.message,
          input.channel ?? "IN_APP",
          input.status ?? "SENT",
          input.metadata ?? {},
        ]
      );
    },
    async listReleaseQueueSummaries() {
      const requests = await this.listApprovedRequests();
      const summaries: ReleaseQueueSummary[] = [];
      for (const request of requests) {
        const eligibleDocuments = await this.listEligibleDocuments(request.id);
        const releases = await this.listReleasesByRequestId(request.id);
        const proofs = await this.listProofs(request.id);
        summaries.push({
          request,
          eligibleDocumentCount: eligibleDocuments.length,
          releasedDocumentCount: releases.filter((release) => release.releaseStatus === "RELEASED").length,
          verifiedProofCount: proofs.filter((proof) => proof.verificationStatus === "VERIFIED").length,
        });
      }
      return summaries;
    },
    async listProofs(requestId) {
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
      return result.rows.map((row: Record<string, unknown>) => mapProof(row));
    },
  };
}
