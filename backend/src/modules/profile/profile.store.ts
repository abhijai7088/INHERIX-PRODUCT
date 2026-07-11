import type { Pool } from "pg";

import type {
  ProfilePreferencesRecord,
  ProfilePreferencesUpdateInput,
  ProfilePrivacyDeletionRequestInput,
  ProfilePrivacyExportRequestInput,
  ProfilePrivacyRequest,
  ProfilePrivacyRequestStatus,
  ProfilePrivacyRequestType,
  ProfilePrivacyUpdateInput,
  ProfileRole,
} from "./types.js";

function toIso(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: Record<string, unknown>): ProfilePreferencesRecord {
  return {
    userId: String(row.user_id),
    emailEnabled: Boolean(row.email_enabled),
    smsEnabled: Boolean(row.sms_enabled),
    inAppEnabled: Boolean(row.in_app_enabled),
    workflowEnabled: Boolean(row.workflow_enabled),
    securityEnabled: Boolean(row.security_enabled),
    releaseEnabled: Boolean(row.release_enabled),
    complianceEnabled: Boolean(row.compliance_enabled),
    shareContactWithNominees: Boolean(row.share_contact_with_nominees),
    shareActivityWithNominees: Boolean(row.share_activity_with_nominees),
    allowDataExports: Boolean(row.allow_data_exports),
    allowTrustedDeviceTracking: Boolean(row.allow_trusted_device_tracking),
    lastReviewedAt: toIso(row.last_reviewed_at as string | Date | null | undefined),
    createdAt: toIso(row.created_at as string | Date | null | undefined) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null | undefined) ?? new Date().toISOString(),
  };
}

function mapJsonValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value as T;
}

function mapPrivacyRequestRow(row: Record<string, unknown>): ProfilePrivacyRequest {
  return {
    id: String(row.id),
    requestType: String(row.request_type) as ProfilePrivacyRequestType,
    status: String(row.status) as ProfilePrivacyRequestStatus,
    reason: typeof row.reason === "string" ? row.reason : null,
    exportFormat: typeof row.export_format === "string" ? row.export_format : null,
    exportPayload: mapJsonValue<Record<string, unknown>>(row.export_payload),
    reviewNotes: typeof row.review_notes === "string" ? row.review_notes : null,
    requestedAt: toIso(row.requested_at as string | Date | null | undefined) ?? new Date().toISOString(),
    reviewedAt: toIso(row.reviewed_at as string | Date | null | undefined),
    completedAt: toIso(row.completed_at as string | Date | null | undefined),
    reviewedByUserId: typeof row.reviewed_by_user_id === "string" ? row.reviewed_by_user_id : null,
    reviewedByRole: typeof row.reviewed_by_role === "string" ? (row.reviewed_by_role as ProfileRole) : null,
    createdAt: toIso(row.created_at as string | Date | null | undefined) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null | undefined) ?? new Date().toISOString(),
  };
}

export type ProfileStore = {
  getPreferences(userId: string): Promise<ProfilePreferencesRecord>;
  updatePreferences(userId: string, input: ProfilePreferencesUpdateInput): Promise<ProfilePreferencesRecord>;
  updatePrivacy(userId: string, input: ProfilePrivacyUpdateInput): Promise<ProfilePreferencesRecord>;
  listPrivacyRequests(userId: string, limit?: number): Promise<ProfilePrivacyRequest[]>;
  createPrivacyExportRequest(
    userId: string,
    input: ProfilePrivacyExportRequestInput & { exportPayload: Record<string, unknown> }
  ): Promise<ProfilePrivacyRequest>;
  createPrivacyDeletionRequest(
    userId: string,
    input: ProfilePrivacyDeletionRequestInput
  ): Promise<ProfilePrivacyRequest>;
  reviewPrivacyDeletionRequest(
    userId: string,
    requestId: string,
    input: { status: "APPROVED" | "REJECTED"; reviewNotes?: string | null; reviewedByUserId: string; reviewedByRole: ProfileRole }
  ): Promise<ProfilePrivacyRequest | null>;
};

export function createPostgresProfileStore(pool: Pool): ProfileStore {
  async function ensurePreferences(userId: string) {
    const result = await pool.query(
      `INSERT INTO profile_preferences (
         user_id,
         email_enabled,
         sms_enabled,
         in_app_enabled,
         workflow_enabled,
         security_enabled,
         release_enabled,
         compliance_enabled,
         share_contact_with_nominees,
         share_activity_with_nominees,
         allow_data_exports,
         allow_trusted_device_tracking
       )
       VALUES ($1, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE, TRUE)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [userId]
    );

    if (result.rows[0]) {
      return mapRow(result.rows[0] as Record<string, unknown>);
    }

    const existing = await pool.query(`SELECT * FROM profile_preferences WHERE user_id = $1 LIMIT 1`, [userId]);
    if (existing.rows[0]) {
      return mapRow(existing.rows[0] as Record<string, unknown>);
    }

    throw new Error("Profile preferences could not be loaded.");
  }

  async function updatePreferences(userId: string, input: ProfilePreferencesUpdateInput) {
    const result = await pool.query(
      `UPDATE profile_preferences
       SET email_enabled = $2,
           sms_enabled = $3,
           in_app_enabled = $4,
           workflow_enabled = $5,
           security_enabled = $6,
           release_enabled = $7,
           compliance_enabled = $8,
           last_reviewed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        input.emailEnabled,
        input.smsEnabled,
        input.inAppEnabled,
        input.workflowEnabled,
        input.securityEnabled,
        input.releaseEnabled,
        input.complianceEnabled,
      ]
    );

    if (result.rows[0]) {
      return mapRow(result.rows[0] as Record<string, unknown>);
    }

    return ensurePreferences(userId);
  }

  async function updatePrivacy(userId: string, input: ProfilePrivacyUpdateInput) {
    const result = await pool.query(
      `UPDATE profile_preferences
       SET share_contact_with_nominees = $2,
           share_activity_with_nominees = $3,
           allow_data_exports = $4,
           allow_trusted_device_tracking = $5,
           last_reviewed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        input.shareContactWithNominees,
        input.shareActivityWithNominees,
        input.allowDataExports,
        input.allowTrustedDeviceTracking,
      ]
    );

    if (result.rows[0]) {
      return mapRow(result.rows[0] as Record<string, unknown>);
    }

    return ensurePreferences(userId);
  }

  async function listPrivacyRequests(userId: string, limit = 6) {
    const result = await pool.query(
      `SELECT *
       FROM privacy_requests
       WHERE user_id = $1
       ORDER BY requested_at DESC, created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row) => mapPrivacyRequestRow(row as Record<string, unknown>));
  }

  async function createPrivacyExportRequest(
    userId: string,
    input: ProfilePrivacyExportRequestInput & { exportPayload: Record<string, unknown> }
  ) {
    const result = await pool.query(
      `INSERT INTO privacy_requests (
         user_id,
         request_type,
         status,
         reason,
         export_format,
         export_payload,
         requested_at,
         completed_at
       )
       VALUES ($1, 'DATA_EXPORT', 'COMPLETED', $2, 'JSON', $3::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, input.reason ?? null, JSON.stringify(input.exportPayload)]
    );

    if (!result.rows[0]) {
      throw new Error("Privacy export request could not be created.");
    }

    return mapPrivacyRequestRow(result.rows[0] as Record<string, unknown>);
  }

  async function createPrivacyDeletionRequest(userId: string, input: ProfilePrivacyDeletionRequestInput) {
    const result = await pool.query(
      `INSERT INTO privacy_requests (
         user_id,
         request_type,
         status,
         reason,
         requested_at
       )
       VALUES ($1, 'ACCOUNT_DELETION', 'REQUESTED', $2, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, input.reason ?? null]
    );

    if (!result.rows[0]) {
      throw new Error("Privacy deletion request could not be created.");
    }

    return mapPrivacyRequestRow(result.rows[0] as Record<string, unknown>);
  }

  async function reviewPrivacyDeletionRequest(
    userId: string,
    requestId: string,
    input: { status: "APPROVED" | "REJECTED"; reviewNotes?: string | null; reviewedByUserId: string; reviewedByRole: ProfileRole }
  ) {
    const result = await pool.query(
      `UPDATE privacy_requests
       SET status = $3,
           review_notes = $4,
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by_user_id = $5,
           reviewed_by_role = $6
       WHERE id = $1
         AND user_id = $2
         AND request_type = 'ACCOUNT_DELETION'
       RETURNING *`,
      [requestId, userId, input.status, input.reviewNotes ?? null, input.reviewedByUserId, input.reviewedByRole]
    );

    if (!result.rows[0]) {
      return null;
    }

    return mapPrivacyRequestRow(result.rows[0] as Record<string, unknown>);
  }

  return {
    getPreferences: ensurePreferences,
    updatePreferences,
    updatePrivacy,
    listPrivacyRequests,
    createPrivacyExportRequest,
    createPrivacyDeletionRequest,
    reviewPrivacyDeletionRequest,
  };
}
