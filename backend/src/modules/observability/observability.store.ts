import type { Pool } from "pg";

import type { UserRole } from "../auth/types.js";

type NullableDate = string | Date | null | undefined;

function toIso(value: NullableDate) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toJson(value: unknown) {
  return (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
}

export type AuditLogRow = {
  id: string;
  userId: string | null;
  role: UserRole | null;
  action: string;
  moduleName: string | null;
  entityType: string | null;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
};

export type SecurityEventRow = {
  id: string;
  userId: string | null;
  eventType: string;
  eventDescription: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  isResolved: boolean;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
};

export type SessionRow = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  ipAddress: string | null;
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
};

export type NotificationRow = {
  id: string;
  userId: string;
  title: string;
  message: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
  status: "PENDING" | "SENT" | "FAILED";
  readAt: string | null;
  sentAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
  actorRole: UserRole | null;
};

export type PendingTriggerRow = {
  id: string;
  customerId: string;
  nomineeId: string;
  nomineeName: string;
  requestKind: string;
  subjectLine: string;
  priority: string;
  status: string;
  latestActivityAt: string;
  createdAt: string;
};

export type PlatformSettingRow = {
  id: string;
  settingKey: string;
  groupName: string;
  label: string;
  description: string | null;
  value: Record<string, unknown>;
  editableBy: UserRole;
  sensitive: boolean;
  source: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserRow = {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: UserRole;
  status: string;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  mfaEnabled: boolean;
  mustResetPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
};

export function createPostgresObservabilityStore(pool: Pool) {
  async function listAuditLogs(params: {
    userId?: string | null;
    limit?: number;
    offset?: number;
    action?: string | null;
    moduleName?: string | null;
    fromDate?: Date | null;
    toDate?: Date | null;
  }) {
    const limit = Math.max(1, Math.min(params.limit ?? 25, 100));
    const offset = Math.max(0, params.offset ?? 0);
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (params.userId) {
      values.push(params.userId);
      clauses.push(`a.user_id = $${values.length}`);
    }

    if (params.action) {
      values.push(params.action);
      clauses.push(`a.action = $${values.length}`);
    }

    if (params.moduleName) {
      values.push(params.moduleName);
      clauses.push(`lower(a.module_name) = lower($${values.length})`);
    }

    if (params.fromDate) {
      values.push(params.fromDate);
      clauses.push(`a.created_at >= $${values.length}`);
    }

    if (params.toDate) {
      values.push(params.toDate);
      clauses.push(`a.created_at <= $${values.length}`);
    }

    values.push(limit, offset);
    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
         a.id,
         a.user_id,
         a.role,
         a.action,
         a.module_name,
         a.entity_type,
         a.entity_id,
         a.old_value,
         a.new_value,
         a.ip_address,
         a.device_info,
         a.created_at,
         u.full_name AS actor_name,
         u.email AS actor_email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: row.user_id ? String(row.user_id) : null,
      role: row.role ? (String(row.role) as UserRole) : null,
      action: String(row.action),
      moduleName: row.module_name ? String(row.module_name) : null,
      entityType: row.entity_type ? String(row.entity_type) : null,
      entityId: row.entity_id ? String(row.entity_id) : null,
      oldValue: row.old_value ? toJson(row.old_value) : null,
      newValue: row.new_value ? toJson(row.new_value) : null,
      ipAddress: row.ip_address ? String(row.ip_address) : null,
      deviceInfo: row.device_info ? String(row.device_info) : null,
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      actorName: row.actor_name ? String(row.actor_name) : null,
      actorEmail: row.actor_email ? String(row.actor_email) : null,
    })) as AuditLogRow[];
  }

  async function listSecurityEvents(params: { userId?: string | null; limit?: number; offset?: number }) {
    const limit = Math.max(1, Math.min(params.limit ?? 25, 100));
    const offset = Math.max(0, params.offset ?? 0);
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (params.userId) {
      values.push(params.userId);
      clauses.push(`s.user_id = $${values.length}`);
    }

    values.push(limit, offset);
    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
         s.id,
         s.user_id,
         s.event_type,
         s.event_description,
         s.ip_address,
         s.device_info,
         s.risk_level,
         s.is_resolved,
         s.created_at,
         u.full_name AS actor_name,
         u.email AS actor_email
       FROM security_events s
       LEFT JOIN users u ON u.id = s.user_id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: row.user_id ? String(row.user_id) : null,
      eventType: String(row.event_type),
      eventDescription: row.event_description ? String(row.event_description) : null,
      ipAddress: row.ip_address ? String(row.ip_address) : null,
      deviceInfo: row.device_info ? String(row.device_info) : null,
      riskLevel: String(row.risk_level) as SecurityEventRow["riskLevel"],
      isResolved: Boolean(row.is_resolved),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      actorName: row.actor_name ? String(row.actor_name) : null,
      actorEmail: row.actor_email ? String(row.actor_email) : null,
    })) as SecurityEventRow[];
  }

  async function listSessions(params: { userId?: string | null; limit?: number; offset?: number }) {
    const limit = Math.max(1, Math.min(params.limit ?? 25, 100));
    const offset = Math.max(0, params.offset ?? 0);
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (params.userId) {
      values.push(params.userId);
      clauses.push(`s.user_id = $${values.length}`);
    }

    values.push(limit, offset);
    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
         s.id,
         s.user_id,
         u.full_name,
         u.email,
         u.role,
         s.ip_address,
         s.device_info,
         s.browser_info,
         s.location_info,
         s.is_active,
         s.created_at,
         s.expires_at,
         s.revoked_at,
         s.rotated_at
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: String(row.user_id),
      fullName: String(row.full_name),
      email: String(row.email),
      role: String(row.role) as UserRole,
      ipAddress: row.ip_address ? String(row.ip_address) : null,
      deviceInfo: row.device_info ? String(row.device_info) : null,
      browserInfo: row.browser_info ? String(row.browser_info) : null,
      locationInfo: row.location_info ? String(row.location_info) : null,
      isActive: Boolean(row.is_active),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      expiresAt: toIso(row.expires_at as NullableDate) ?? new Date().toISOString(),
      revokedAt: toIso(row.revoked_at as NullableDate),
      rotatedAt: toIso(row.rotated_at as NullableDate),
    })) as SessionRow[];
  }

  async function listNotifications(params: { userId: string; limit?: number; offset?: number }) {
    const limit = Math.max(1, Math.min(params.limit ?? 25, 100));
    const offset = Math.max(0, params.offset ?? 0);

    const result = await pool.query(
      `SELECT
         n.id,
         n.user_id,
         n.title,
         n.message,
         n.channel,
         n.status,
         n.read_at,
         n.sent_at,
         n.metadata,
         n.created_at,
         u.full_name AS actor_name,
         u.role AS actor_role
       FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2
       OFFSET $3`,
      [params.userId, limit, offset]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title),
      message: String(row.message),
      channel: String(row.channel) as NotificationRow["channel"],
      status: String(row.status) as NotificationRow["status"],
      readAt: toIso(row.read_at as NullableDate),
      sentAt: toIso(row.sent_at as NullableDate),
      metadata: toJson(row.metadata),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      actorName: row.actor_name ? String(row.actor_name) : null,
      actorRole: row.actor_role ? (String(row.actor_role) as UserRole) : null,
    })) as NotificationRow[];
  }

  async function markNotificationRead(userId: string, notificationId: string) {
    const result = await pool.query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );

    return Boolean(result.rows[0]);
  }

  async function markAllNotificationsRead(userId: string) {
    const result = await pool.query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );

    return result.rowCount ?? 0;
  }

  async function countUnreadNotifications(userId: string) {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );

    return Number(result.rows[0]?.total ?? 0);
  }

  async function countSecurityEvents(userId: string | null, riskLevel?: string, unresolvedOnly = false) {
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (userId) {
      values.push(userId);
      clauses.push(`user_id = $${values.length}`);
    }

    if (riskLevel) {
      values.push(riskLevel);
      clauses.push(`risk_level = $${values.length}`);
    }

    if (unresolvedOnly) {
      clauses.push("is_resolved = FALSE");
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await pool.query(`SELECT COUNT(*)::int AS total FROM security_events ${whereClause}`, values);
    return Number(result.rows[0]?.total ?? 0);
  }

  async function countAuditLogs(userId: string | null) {
    const values: unknown[] = [];
    const whereClause = userId ? "WHERE user_id = $1" : "";
    if (userId) {
      values.push(userId);
    }

    const result = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs ${whereClause}`, values);
    return Number(result.rows[0]?.total ?? 0);
  }

  async function listPendingTriggerRequests(limit = 8) {
    const result = await pool.query(
      `SELECT
         tr.id,
         tr.customer_id,
         tr.nominee_id,
         n.full_name AS nominee_name,
         tr.request_kind,
         tr.subject_line,
         tr.priority,
         tr.status,
         tr.latest_activity_at,
         tr.created_at
       FROM trigger_requests tr
       INNER JOIN nominees n ON n.id = tr.nominee_id
       WHERE tr.status IN ('PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED')
       ORDER BY tr.latest_activity_at DESC, tr.created_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 25))]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      customerId: String(row.customer_id),
      nomineeId: String(row.nominee_id),
      nomineeName: String(row.nominee_name),
      requestKind: String(row.request_kind),
      subjectLine: String(row.subject_line),
      priority: String(row.priority),
      status: String(row.status),
      latestActivityAt: toIso(row.latest_activity_at as NullableDate) ?? new Date().toISOString(),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
    })) as PendingTriggerRow[];
  }

  async function listPlatformSettings() {
    const result = await pool.query(
      `SELECT
         ps.id,
         ps.setting_key,
         ps.group_name,
         ps.label,
         ps.description,
         ps.value,
         ps.editable_by,
         ps.sensitive,
         ps.source,
         ps.updated_by,
         ps.created_at,
         ps.updated_at
       FROM platform_settings ps
       ORDER BY ps.group_name, ps.setting_key`
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      settingKey: String(row.setting_key),
      groupName: String(row.group_name),
      label: String(row.label),
      description: row.description ? String(row.description) : null,
      value: toJson(row.value),
      editableBy: String(row.editable_by) as UserRole,
      sensitive: Boolean(row.sensitive),
      source: String(row.source),
      updatedBy: row.updated_by ? String(row.updated_by) : null,
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      updatedAt: toIso(row.updated_at as NullableDate) ?? new Date().toISOString(),
    })) as PlatformSettingRow[];
  }

  async function upsertPlatformSetting(input: {
    settingKey: string;
    groupName: string;
    label: string;
    description: string | null;
    value: Record<string, unknown>;
    editableBy: UserRole;
    sensitive: boolean;
    source: string;
    updatedBy: string | null;
  }) {
    const result = await pool.query(
      `INSERT INTO platform_settings
        (setting_key, group_name, label, description, value, editable_by, sensitive, source, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (setting_key)
       DO UPDATE SET
         group_name = EXCLUDED.group_name,
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         value = EXCLUDED.value,
         editable_by = EXCLUDED.editable_by,
         sensitive = EXCLUDED.sensitive,
         source = EXCLUDED.source,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        input.settingKey,
        input.groupName,
        input.label,
        input.description,
        input.value,
        input.editableBy,
        input.sensitive,
        input.source,
        input.updatedBy,
      ]
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      settingKey: String(row.setting_key),
      groupName: String(row.group_name),
      label: String(row.label),
      description: row.description ? String(row.description) : null,
      value: toJson(row.value),
      editableBy: String(row.editable_by) as UserRole,
      sensitive: Boolean(row.sensitive),
      source: String(row.source),
      updatedBy: row.updated_by ? String(row.updated_by) : null,
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      updatedAt: toIso(row.updated_at as NullableDate) ?? new Date().toISOString(),
    } satisfies PlatformSettingRow;
  }

  async function listAdminUsers() {
    const result = await pool.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.mobile,
         u.role,
         u.status,
         u.is_email_verified,
         u.is_mobile_verified,
         u.mfa_enabled,
         u.must_reset_password,
         u.last_login_at,
         u.created_at,
         u.updated_at,
         COALESCE(active_sessions.active_session_count, 0) AS active_session_count
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS active_session_count
         FROM user_sessions
         WHERE is_active = TRUE
         GROUP BY user_id
       ) active_sessions ON active_sessions.user_id = u.id
       WHERE u.role IN ('ADMIN', 'SUPER_ADMIN')
       ORDER BY u.role DESC, u.updated_at DESC`
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      mobile: row.mobile ? String(row.mobile) : null,
      role: String(row.role) as UserRole,
      status: String(row.status),
      isEmailVerified: Boolean(row.is_email_verified),
      isMobileVerified: Boolean(row.is_mobile_verified),
      mfaEnabled: Boolean(row.mfa_enabled),
      mustResetPassword: Boolean(row.must_reset_password),
      lastLoginAt: toIso(row.last_login_at as NullableDate),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      updatedAt: toIso(row.updated_at as NullableDate) ?? new Date().toISOString(),
      activeSessionCount: Number(row.active_session_count ?? 0),
    })) as AdminUserRow[];
  }

  async function listVerificationOfficers() {
    const result = await pool.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.mobile,
         u.role,
         u.status,
         u.is_email_verified,
         u.is_mobile_verified,
         u.mfa_enabled,
         u.last_login_at,
         u.created_at,
         u.updated_at,
         COALESCE(active_sessions.active_session_count, 0) AS active_session_count
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS active_session_count
         FROM user_sessions
         WHERE is_active = TRUE
         GROUP BY user_id
       ) active_sessions ON active_sessions.user_id = u.id
       WHERE u.role = 'VERIFICATION_OFFICER'
       ORDER BY u.updated_at DESC`
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      mobile: row.mobile ? String(row.mobile) : null,
      role: String(row.role) as UserRole,
      status: String(row.status),
      isEmailVerified: Boolean(row.is_email_verified),
      isMobileVerified: Boolean(row.is_mobile_verified),
      mfaEnabled: Boolean(row.mfa_enabled),
      mustResetPassword: Boolean(row.must_reset_password),
      lastLoginAt: toIso(row.last_login_at as NullableDate),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      updatedAt: toIso(row.updated_at as NullableDate) ?? new Date().toISOString(),
      activeSessionCount: Number(row.active_session_count ?? 0),
    })) as AdminUserRow[];
  }

  async function createAdminUser(input: {
    fullName: string;
    email: string;
    mobile: string | null;
    passwordHash: string;
    role: UserRole;
    status: string;
    isEmailVerified: boolean;
    isMobileVerified: boolean;
    mfaEnabled: boolean;
    mustResetPassword?: boolean;
  }) {
    const result = await pool.query(
      `INSERT INTO users
        (full_name, email, mobile, password_hash, role, status, is_email_verified, is_mobile_verified, mfa_enabled, must_reset_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.fullName,
        input.email,
        input.mobile,
        input.passwordHash,
        input.role,
        input.status,
        input.isEmailVerified,
        input.isMobileVerified,
        input.mfaEnabled,
        input.mustResetPassword ?? false,
      ]
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      mobile: row.mobile ? String(row.mobile) : null,
      role: String(row.role) as UserRole,
      status: String(row.status),
      isEmailVerified: Boolean(row.is_email_verified),
      isMobileVerified: Boolean(row.is_mobile_verified),
      mfaEnabled: Boolean(row.mfa_enabled),
      mustResetPassword: Boolean(row.must_reset_password),
      lastLoginAt: toIso(row.last_login_at as NullableDate),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      updatedAt: toIso(row.updated_at as NullableDate) ?? new Date().toISOString(),
      activeSessionCount: 0,
    } as AdminUserRow;
  }

  async function updateAdminUser(
    id: string,
    values: Partial<{
      fullName: string;
      mobile: string | null;
      passwordHash: string;
      role: UserRole;
      status: string;
      mfaEnabled: boolean;
      isEmailVerified: boolean;
      isMobileVerified: boolean;
      mustResetPassword: boolean;
    }>
  ) {
    const result = await pool.query(
      `UPDATE users
       SET full_name = COALESCE($2, full_name),
           mobile = COALESCE($3, mobile),
           password_hash = COALESCE($4, password_hash),
           role = COALESCE($5, role),
           status = COALESCE($6, status),
           mfa_enabled = COALESCE($7, mfa_enabled),
           is_email_verified = COALESCE($8, is_email_verified),
           is_mobile_verified = COALESCE($9, is_mobile_verified),
           must_reset_password = COALESCE($10, must_reset_password)
       WHERE id = $1 AND role IN ('ADMIN', 'SUPER_ADMIN')
       RETURNING *`,
      [
        id,
        values.fullName ?? null,
        values.mobile ?? null,
        values.passwordHash ?? null,
        values.role ?? null,
        values.status ?? null,
        values.mfaEnabled ?? null,
        values.isEmailVerified ?? null,
        values.isMobileVerified ?? null,
        values.mustResetPassword ?? null,
      ]
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      mobile: row.mobile ? String(row.mobile) : null,
      role: String(row.role) as UserRole,
      status: String(row.status),
      isEmailVerified: Boolean(row.is_email_verified),
      isMobileVerified: Boolean(row.is_mobile_verified),
      mfaEnabled: Boolean(row.mfa_enabled),
      mustResetPassword: Boolean(row.must_reset_password),
      lastLoginAt: toIso(row.last_login_at as NullableDate),
      createdAt: toIso(row.created_at as NullableDate) ?? new Date().toISOString(),
      updatedAt: toIso(row.updated_at as NullableDate) ?? new Date().toISOString(),
      activeSessionCount: 0,
    } as AdminUserRow;
  }

  async function countSessions(userId: string | null, activeOnly = false) {
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (userId) {
      values.push(userId);
      clauses.push(`user_id = $${values.length}`);
    }

    if (activeOnly) {
      clauses.push("is_active = TRUE");
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await pool.query(`SELECT COUNT(*)::int AS total FROM user_sessions ${whereClause}`, values);
    return Number(result.rows[0]?.total ?? 0);
  }

  async function revokeSessionsByDeviceSignature(params: {
    userId: string;
    deviceInfo: string | null;
    browserInfo: string | null;
    locationInfo: string | null;
  }) {
    const result = await pool.query(
      `UPDATE user_sessions
       SET is_active = FALSE,
           revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
       WHERE user_id = $1
         AND device_info IS NOT DISTINCT FROM $2
         AND browser_info IS NOT DISTINCT FROM $3
         AND location_info IS NOT DISTINCT FROM $4
         AND is_active = TRUE`,
      [params.userId, params.deviceInfo, params.browserInfo, params.locationInfo]
    );

    return result.rowCount ?? 0;
  }

  return {
    listAuditLogs,
    listSecurityEvents,
    listSessions,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    countUnreadNotifications,
    countSecurityEvents,
    countAuditLogs,
    countSessions,
    listPendingTriggerRequests,
    revokeSessionsByDeviceSignature,
    listPlatformSettings,
    upsertPlatformSetting,
    listAdminUsers,
    listVerificationOfficers,
    createAdminUser,
    updateAdminUser,
  };
}

export type ObservabilityStore = ReturnType<typeof createPostgresObservabilityStore>;
