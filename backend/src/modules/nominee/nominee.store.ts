import type { Pool } from "pg";

import type { NomineeInviteInput, NomineeRecord, NomineeUpdateInput, NomineeViewRecord } from "./types.js";

function toIso(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNominee(row: Record<string, unknown>): NomineeRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    nomineeUserId: row.nominee_user_id ? String(row.nominee_user_id) : null,
    fullName: String(row.full_name),
    email: row.email ? String(row.email) : null,
    mobile: row.mobile ? String(row.mobile) : null,
    relationship: String(row.relationship),
    customRelationship: row.custom_relationship ? String(row.custom_relationship) : null,
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status) as NomineeRecord["status"],
    verificationStatus: String(row.verification_status),
    invitationTokenHash: row.invitation_token_hash ? String(row.invitation_token_hash) : null,
    invitationExpiresAt: toIso(row.invitation_expires_at as string | Date | null),
    invitedAt: toIso(row.invited_at as string | Date | null) ?? new Date().toISOString(),
    acceptedAt: toIso(row.accepted_at as string | Date | null),
    removedAt: toIso(row.removed_at as string | Date | null),
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function toNomineeView(row: Record<string, unknown>): NomineeViewRecord {
  const nominee = toNominee(row);
  return {
    ...nominee,
    invitationStatus:
      nominee.status === "ACTIVE"
        ? "ACCEPTED"
        : nominee.status === "REMOVED"
          ? "REMOVED"
          : nominee.acceptedAt
            ? "ACCEPTED"
            : "SENT",
    assignedCount: Number(row.assigned_count ?? 0),
  };
}

export type NomineeStore = {
  listNominees(customerId: string): Promise<NomineeViewRecord[]>;
  findNomineeById(nomineeId: string): Promise<NomineeViewRecord | null>;
  findNomineeByUserId(nomineeUserId: string): Promise<NomineeViewRecord | null>;
  findNomineeByEmail(customerId: string, email?: string): Promise<NomineeViewRecord | null>;
  findNomineeByInvitationTokenHash(tokenHash: string): Promise<NomineeViewRecord | null>;
  createNominee(
    input: NomineeInviteInput & { customerId: string },
    invitationTokenHash: string,
    invitationExpiresAt: Date
  ): Promise<NomineeViewRecord>;
  updateNominee(nomineeId: string, values: NomineeUpdateInput): Promise<NomineeViewRecord | null>;
  resendInvitation(nomineeId: string, invitationTokenHash: string, invitationExpiresAt: Date): Promise<NomineeViewRecord | null>;
  acceptInvitation(nomineeId: string, userId: string): Promise<NomineeViewRecord | null>;
  removeNominee(nomineeId: string): Promise<NomineeViewRecord | null>;
};

export function createPostgresNomineeStore(pool: Pool): NomineeStore {
  async function findById(nomineeId: string) {
    const result = await pool.query(
      `SELECT
         n.id,
         n.customer_id,
         n.nominee_user_id,
         n.full_name,
         n.email,
         n.mobile,
         n.relationship,
         n.custom_relationship,
         n.notes,
         n.status,
         n.verification_status,
         n.invitation_token_hash,
         n.invitation_expires_at,
         n.invited_at,
         n.accepted_at,
         n.removed_at,
         n.created_at,
         n.updated_at,
       COUNT(ar.id)::int AS assigned_count
       FROM nominees n
      LEFT JOIN document_access_rules ar ON ar.nominee_id = n.id AND ar.is_active = TRUE AND ar.deleted_at IS NULL
       WHERE n.id = $1
       GROUP BY n.id`,
      [nomineeId]
    );

    return result.rows[0] ? toNomineeView(result.rows[0]) : null;
  }

  return {
    async listNominees(customerId) {
      const result = await pool.query(
        `SELECT
           n.id,
           n.customer_id,
           n.nominee_user_id,
           n.full_name,
           n.email,
           n.mobile,
           n.relationship,
           n.custom_relationship,
           n.notes,
           n.status,
           n.verification_status,
           n.invitation_token_hash,
           n.invitation_expires_at,
           n.invited_at,
           n.accepted_at,
           n.removed_at,
           n.created_at,
           n.updated_at,
         COUNT(ar.id)::int AS assigned_count
         FROM nominees n
         LEFT JOIN document_access_rules ar ON ar.nominee_id = n.id AND ar.is_active = TRUE AND ar.deleted_at IS NULL
         WHERE n.customer_id = $1
         GROUP BY n.id
         ORDER BY n.updated_at DESC`,
        [customerId]
      );

      return result.rows.map((row: Record<string, unknown>) => toNomineeView(row));
    },
    async findNomineeById(nomineeId) {
      return findById(nomineeId);
    },
    async findNomineeByUserId(nomineeUserId) {
      const result = await pool.query(
        `SELECT
           n.id,
           n.customer_id,
           n.nominee_user_id,
           n.full_name,
           n.email,
           n.mobile,
           n.relationship,
           n.custom_relationship,
           n.notes,
           n.status,
           n.verification_status,
           n.invitation_token_hash,
           n.invitation_expires_at,
           n.invited_at,
           n.accepted_at,
           n.removed_at,
           n.created_at,
           n.updated_at,
         COUNT(ar.id)::int AS assigned_count
         FROM nominees n
         LEFT JOIN document_access_rules ar ON ar.nominee_id = n.id AND ar.is_active = TRUE AND ar.deleted_at IS NULL
         WHERE n.nominee_user_id = $1 AND n.status = 'ACTIVE'
         GROUP BY n.id
         LIMIT 1`,
        [nomineeUserId]
      );

      return result.rows[0] ? toNomineeView(result.rows[0]) : null;
    },
    async findNomineeByEmail(customerIdOrEmail: string, email?: string) {
      const customerId = email ? customerIdOrEmail : null;
      const searchEmail = email ?? customerIdOrEmail;
      const result = await pool.query(
        customerId
          ? `SELECT
               n.id,
               n.customer_id,
               n.nominee_user_id,
               n.full_name,
               n.email,
               n.mobile,
               n.relationship,
               n.custom_relationship,
               n.notes,
               n.status,
               n.verification_status,
               n.invitation_token_hash,
               n.invitation_expires_at,
               n.invited_at,
               n.accepted_at,
               n.removed_at,
               n.created_at,
               n.updated_at,
             COUNT(ar.id)::int AS assigned_count
             FROM nominees n
             LEFT JOIN document_access_rules ar ON ar.nominee_id = n.id AND ar.is_active = TRUE AND ar.deleted_at IS NULL
             WHERE n.customer_id = $1 AND lower(n.email) = lower($2)
             GROUP BY n.id
             LIMIT 1`
          : `SELECT
               n.id,
               n.customer_id,
               n.nominee_user_id,
               n.full_name,
               n.email,
               n.mobile,
               n.relationship,
               n.custom_relationship,
               n.notes,
               n.status,
               n.verification_status,
               n.invitation_token_hash,
               n.invitation_expires_at,
               n.invited_at,
               n.accepted_at,
               n.removed_at,
               n.created_at,
               n.updated_at,
             COUNT(ar.id)::int AS assigned_count
             FROM nominees n
             LEFT JOIN document_access_rules ar ON ar.nominee_id = n.id AND ar.is_active = TRUE AND ar.deleted_at IS NULL
             WHERE lower(n.email) = lower($1) AND n.status <> 'REMOVED'
             GROUP BY n.id
             ORDER BY
               CASE
                 WHEN n.status = 'ACTIVE' THEN 0
                 WHEN n.status = 'INVITED' THEN 1
                 ELSE 2
               END,
               n.updated_at DESC
             LIMIT 1`,
        customerId ? [customerId, searchEmail] : [searchEmail]
      );

      return result.rows[0] ? toNomineeView(result.rows[0]) : null;
    },
    async findNomineeByInvitationTokenHash(tokenHash) {
      const result = await pool.query(
        `SELECT
           n.id,
           n.customer_id,
           n.nominee_user_id,
           n.full_name,
           n.email,
           n.mobile,
           n.relationship,
           n.custom_relationship,
           n.notes,
           n.status,
           n.verification_status,
           n.invitation_token_hash,
           n.invitation_expires_at,
           n.invited_at,
           n.accepted_at,
           n.removed_at,
           n.created_at,
           n.updated_at,
           COUNT(ar.id)::int AS assigned_count
         FROM nominees n
         LEFT JOIN document_access_rules ar ON ar.nominee_id = n.id AND ar.is_active = TRUE AND ar.deleted_at IS NULL
         WHERE n.invitation_token_hash = $1
         GROUP BY n.id
         LIMIT 1`,
        [tokenHash]
      );

      return result.rows[0] ? toNomineeView(result.rows[0]) : null;
    },
    async createNominee(input, invitationTokenHash, invitationExpiresAt) {
      const result = await pool.query(
        `INSERT INTO nominees
          (customer_id, nominee_user_id, full_name, email, mobile, relationship, custom_relationship, notes, status, verification_status, invitation_token_hash, invitation_expires_at, invited_at, accepted_at, removed_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'INVITED', 'PENDING', $8, $9, CURRENT_TIMESTAMP, NULL, NULL)
         RETURNING id`,
        [
          input.customerId,
          input.fullName,
          input.email,
          input.mobile,
          input.relationship,
          input.customRelationship,
          input.notes,
          invitationTokenHash,
          invitationExpiresAt,
        ]
      );

      return findById(String(result.rows[0].id)) as Promise<NomineeViewRecord>;
    },
    async updateNominee(nomineeId, values) {
      const result = await pool.query(
        `UPDATE nominees
         SET full_name = COALESCE($2, full_name),
             email = COALESCE($3, email),
             mobile = COALESCE($4, mobile),
             relationship = COALESCE($5, relationship),
             custom_relationship = COALESCE($6, custom_relationship),
             notes = COALESCE($7, notes)
         WHERE id = $1
         RETURNING id`,
        [
          nomineeId,
          values.fullName ?? null,
          values.email ?? null,
          values.mobile ?? null,
          values.relationship ?? null,
          values.customRelationship ?? null,
          values.notes ?? null,
        ]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findById(nomineeId);
    },
    async resendInvitation(nomineeId, invitationTokenHash, invitationExpiresAt) {
      const result = await pool.query(
        `UPDATE nominees
         SET invitation_token_hash = $2,
             invitation_expires_at = $3,
             invited_at = CURRENT_TIMESTAMP,
             status = CASE WHEN nominee_user_id IS NULL THEN 'INVITED' ELSE status END
         WHERE id = $1
         RETURNING id`,
        [nomineeId, invitationTokenHash, invitationExpiresAt]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findById(nomineeId);
    },
    async acceptInvitation(nomineeId, userId) {
      const result = await pool.query(
        `UPDATE nominees
         SET nominee_user_id = $2,
             status = 'ACTIVE',
             accepted_at = CURRENT_TIMESTAMP,
             invitation_token_hash = NULL,
             invitation_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id`,
        [nomineeId, userId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findById(nomineeId);
    },
    async removeNominee(nomineeId) {
      const result = await pool.query(
        `UPDATE nominees
         SET status = 'REMOVED',
             removed_at = CURRENT_TIMESTAMP,
             invitation_token_hash = NULL,
             invitation_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id`,
        [nomineeId]
      );

      if (!result.rows[0]) {
        return null;
      }

      return findById(nomineeId);
    },
  };
}
