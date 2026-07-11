import type { Pool } from "pg";

import type {
  AuthTokenPurpose,
  AuthTokenRecord,
  SessionRecord,
  SessionView,
  UserRecord,
  UserRole,
  UserStatus,
} from "./types.js";
import type { PermissionDefinition, RbacPermissionKey } from "../rbac/permissions.js";
import { RBAC_ROLE_PERMISSION_KEYS, listRolePermissions } from "../rbac/permissions.js";

function toIso(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    mobile: row.mobile ? String(row.mobile) : null,
    passwordHash: String(row.password_hash),
    role: String(row.role) as UserRole,
    status: String(row.status) as UserStatus,
    isEmailVerified: Boolean(row.is_email_verified),
    isMobileVerified: Boolean(row.is_mobile_verified),
    mfaEnabled: Boolean(row.mfa_enabled),
    mustResetPassword: Boolean(row.must_reset_password),
    lastLoginAt: toIso(row.last_login_at as string | Date | null),
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at as string | Date | null) ?? new Date().toISOString(),
  };
}

function toSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    refreshTokenHash: String(row.refresh_token_hash),
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    deviceInfo: row.device_info ? String(row.device_info) : null,
    browserInfo: row.browser_info ? String(row.browser_info) : null,
    locationInfo: row.location_info ? String(row.location_info) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    isActive: Boolean(row.is_active),
    trustedAt: toIso(row.trusted_at as string | Date | null),
    trustRevokedAt: toIso(row.trust_revoked_at as string | Date | null),
    trustLabel: row.trust_label ? String(row.trust_label) : null,
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    expiresAt: toIso(row.expires_at as string | Date | null) ?? new Date().toISOString(),
    revokedAt: toIso(row.revoked_at as string | Date | null),
    rotatedAt: toIso(row.rotated_at as string | Date | null),
  };
}

function toToken(row: Record<string, unknown>): AuthTokenRecord {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    tokenHash: String(row.token_hash),
    purpose: String(row.purpose) as AuthTokenPurpose,
    expiresAt: toIso(row.expires_at as string | Date | null) ?? new Date().toISOString(),
    usedAt: toIso(row.used_at as string | Date | null),
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export type CreateUserInput = {
  fullName: string;
  email: string;
  mobile: string | null;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  mustResetPassword?: boolean;
};

export type CreateSessionInput = {
  id?: string;
  userId: string;
  refreshTokenHash: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  userAgent: string | null;
  expiresAt: Date;
};

export type CreateTokenInput = {
  userId: string | null;
  tokenHash: string;
  purpose: AuthTokenPurpose;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
};

export type AuditEventInput = {
  userId: string | null;
  role: UserRole | null;
  action: string;
  moduleName: string;
  entityType: string | null;
  entityId: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress: string | null;
  deviceInfo: string | null;
};

export type SecurityEventInput = {
  userId: string | null;
  eventType: string;
  eventDescription: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

export type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  channel?: "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";
  status?: "PENDING" | "SENT" | "FAILED";
  metadata?: Record<string, unknown>;
  sentAt?: Date | null;
};

export type PermissionRecord = PermissionDefinition & {
  id: string;
  createdAt: string;
};

export type RolePermissionRecord = {
  role: UserRole;
  permissionId: string;
  permissionKey: RbacPermissionKey;
  description: string | null;
  module: string | null;
  createdAt: string;
};

export type NomineeAssignmentRecord = {
  id: string;
  customerId: string;
  nomineeUserId: string | null;
  status: string;
  relationship: string;
  email: string | null;
  mobile: string | null;
  fullName: string;
};

export type AuthStore = {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  updateUser(
    id: string,
    values: Partial<
      Pick<
        CreateUserInput,
        "fullName" | "mobile" | "passwordHash" | "role" | "status" | "isEmailVerified" | "isMobileVerified" | "mustResetPassword"
      >
    > & { mfaEnabled?: boolean }
  ): Promise<UserRecord | null>;
  touchLastLogin(id: string): Promise<void>;
  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  findSessionById(id: string): Promise<SessionRecord | null>;
  findSessionByRefreshTokenHash(hash: string): Promise<SessionRecord | null>;
  listActiveSessions(userId: string): Promise<SessionView[]>;
  listSessions(userId: string): Promise<SessionView[]>;
  revokeSession(id: string, reason?: string | null): Promise<SessionRecord | null>;
  revokeAllUserSessions(userId: string, reason?: string | null): Promise<number>;
  rotateSession(id: string, refreshTokenHash: string, expiresAt: Date): Promise<SessionRecord | null>;
  trustSessionById(id: string, label?: string | null): Promise<SessionRecord | null>;
  revokeTrustedSessionById(id: string): Promise<SessionRecord | null>;
  listPermissions(): Promise<PermissionRecord[]>;
  findPermissionByKey(permissionKey: string): Promise<PermissionRecord | null>;
  listPermissionsForRole(role: UserRole): Promise<string[]>;
  listPermissionsForUser(userId: string): Promise<string[]>;
  listRolePermissions(role?: UserRole): Promise<RolePermissionRecord[]>;
  replaceRolePermissions(role: UserRole, permissionKeys: RbacPermissionKey[]): Promise<RolePermissionRecord[]>;
  findNomineeAssignment(customerId: string, nomineeUserId: string): Promise<NomineeAssignmentRecord | null>;
  createAuthToken(input: CreateTokenInput): Promise<AuthTokenRecord>;
  findAuthToken(tokenHash: string, purpose: AuthTokenPurpose): Promise<AuthTokenRecord | null>;
  listAuthTokensByPurpose(userId: string, purpose: AuthTokenPurpose): Promise<AuthTokenRecord[]>;
  revokeAuthTokensByPurpose(userId: string, purpose: AuthTokenPurpose): Promise<number>;
  consumeAuthToken(id: string): Promise<void>;
  insertAuditLog(input: AuditEventInput): Promise<void>;
  insertSecurityEvent(input: SecurityEventInput): Promise<void>;
  resolveSecurityEvent(id: string, userId: string | null): Promise<boolean>;
  createNotification(input: NotificationInput): Promise<void>;
  countSecurityEvents(eventTypes: string[], ipAddress: string | null, since: Date, userId?: string | null): Promise<number>;
};

function mapSessionView(row: Record<string, unknown>): SessionView {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ""),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    role: (String(row.role ?? "CUSTOMER") as UserRole),
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    deviceInfo: row.device_info ? String(row.device_info) : null,
    browserInfo: row.browser_info ? String(row.browser_info) : null,
    locationInfo: row.location_info ? String(row.location_info) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    isActive: Boolean(row.is_active),
    trustedAt: toIso(row.trusted_at as string | Date | null),
    trustRevokedAt: toIso(row.trust_revoked_at as string | Date | null),
    trustLabel: row.trust_label ? String(row.trust_label) : null,
    createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    expiresAt: toIso(row.expires_at as string | Date | null) ?? new Date().toISOString(),
    revokedAt: toIso(row.revoked_at as string | Date | null),
    rotatedAt: toIso(row.rotated_at as string | Date | null),
  };
}

export function createPostgresAuthStore(pool: Pool): AuthStore {
  async function queryPermissions() {
    const result = await pool.query(
      `SELECT id, permission_key, description, module, created_at
       FROM permissions
       ORDER BY permission_key`
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      permissionKey: String(row.permission_key) as RbacPermissionKey,
      description: row.description ? String(row.description) : "",
      module: row.module ? String(row.module) : "",
      createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    }));
  }

  async function queryPermissionsForRole(role: UserRole) {
    const result = await pool.query(
      `SELECT p.permission_key
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role = $1
       ORDER BY p.permission_key`,
      [role]
    );

    if (!result.rows.length) {
      return listRolePermissions(role);
    }

    return result.rows.map((row: Record<string, unknown>) => String(row.permission_key));
  }

  async function queryRolePermissions(role?: UserRole) {
    const params: unknown[] = [];
    const whereClause = role ? "WHERE rp.role = $1" : "";
    if (role) params.push(role);

    const result = await pool.query(
      `SELECT rp.role, rp.permission_id, p.permission_key, p.description, rp.created_at
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       ${whereClause}
       ORDER BY rp.role, p.permission_key`,
      params
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      role: String(row.role) as UserRole,
      permissionId: String(row.permission_id),
      permissionKey: String(row.permission_key) as RbacPermissionKey,
      description: row.description ? String(row.description) : null,
      module: null,
      createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
    }));
  }

  return {
    async findUserByEmail(email) {
      const result = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
      return result.rows[0] ? toUser(result.rows[0]) : null;
    },
    async findUserById(id) {
      const result = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
      return result.rows[0] ? toUser(result.rows[0]) : null;
    },
    async createUser(input) {
      const result = await pool.query(
        `INSERT INTO users (full_name, email, mobile, password_hash, role, status, is_email_verified, is_mobile_verified, must_reset_password)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
          input.mustResetPassword ?? false,
        ]
      );
      return toUser(result.rows[0]);
    },
    async updateUser(id, values) {
      const result = await pool.query(
        `UPDATE users
         SET full_name = COALESCE($2, full_name),
             mobile = COALESCE($3, mobile),
             password_hash = COALESCE($4, password_hash),
             role = COALESCE($5, role),
             status = COALESCE($6, status),
             is_email_verified = COALESCE($7, is_email_verified),
             is_mobile_verified = COALESCE($8, is_mobile_verified),
             mfa_enabled = COALESCE($9, mfa_enabled),
             must_reset_password = COALESCE($10, must_reset_password)
         WHERE id = $1
         RETURNING *`,
        [
          id,
          values.fullName ?? null,
          values.mobile ?? null,
          values.passwordHash ?? null,
          values.role ?? null,
          values.status ?? null,
          values.isEmailVerified ?? null,
          values.isMobileVerified ?? null,
          values.mfaEnabled ?? null,
          values.mustResetPassword ?? null,
        ]
      );
      return result.rows[0] ? toUser(result.rows[0]) : null;
    },
    async touchLastLogin(id) {
      await pool.query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    },
    async createSession(input) {
      const result = await pool.query(
        `INSERT INTO user_sessions
          (id, user_id, refresh_token_hash, ip_address, device_info, browser_info, location_info, user_agent, is_active, trusted_at, trust_revoked_at, trust_label, expires_at)
         VALUES (COALESCE($1, gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,TRUE,NULL,NULL,NULL,$9)
         RETURNING *`,
        [
          input.id ?? null,
          input.userId,
          input.refreshTokenHash,
          input.ipAddress,
          input.deviceInfo,
          input.browserInfo,
          input.locationInfo,
          input.userAgent,
          input.expiresAt,
        ]
      );
      return toSession(result.rows[0]);
    },
    async findSessionById(id) {
      const result = await pool.query("SELECT * FROM user_sessions WHERE id = $1 LIMIT 1", [id]);
      return result.rows[0] ? toSession(result.rows[0]) : null;
    },
    async findSessionByRefreshTokenHash(hash) {
      const result = await pool.query("SELECT * FROM user_sessions WHERE refresh_token_hash = $1 LIMIT 1", [hash]);
      return result.rows[0] ? toSession(result.rows[0]) : null;
    },
    async listActiveSessions(userId) {
      const result = await pool.query(
        `SELECT s.id, s.user_id, u.full_name, u.email, u.role, s.ip_address, s.device_info, s.browser_info, s.location_info, s.user_agent, s.is_active, s.trusted_at, s.trust_revoked_at, s.trust_label, s.created_at, s.expires_at, s.revoked_at, s.rotated_at
         FROM user_sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.user_id = $1 AND s.is_active = TRUE
         ORDER BY s.created_at DESC`,
        [userId]
      );
      return result.rows.map((row: Record<string, unknown>) => mapSessionView(row));
    },
    async listSessions(userId) {
      const result = await pool.query(
        `SELECT s.id, s.user_id, u.full_name, u.email, u.role, s.ip_address, s.device_info, s.browser_info, s.location_info, s.user_agent, s.is_active, s.trusted_at, s.trust_revoked_at, s.trust_label, s.created_at, s.expires_at, s.revoked_at, s.rotated_at
         FROM user_sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.user_id = $1
         ORDER BY s.created_at DESC`,
        [userId]
      );
      return result.rows.map((row: Record<string, unknown>) => mapSessionView(row));
    },
    async revokeSession(id) {
      const result = await pool.query(
        `UPDATE user_sessions
         SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      return result.rows[0] ? toSession(result.rows[0]) : null;
    },
    async trustSessionById(id, label) {
      const result = await pool.query(
        `UPDATE user_sessions
         SET trusted_at = CURRENT_TIMESTAMP,
             trust_revoked_at = NULL,
             trust_label = COALESCE($2, trust_label)
         WHERE id = $1
         RETURNING *`,
        [id, label ?? null]
      );
      return result.rows[0] ? toSession(result.rows[0]) : null;
    },
    async revokeTrustedSessionById(id) {
      const result = await pool.query(
        `UPDATE user_sessions
         SET trust_revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      return result.rows[0] ? toSession(result.rows[0]) : null;
    },
    async revokeAllUserSessions(userId) {
      const result = await pool.query(
        `UPDATE user_sessions
         SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND is_active = TRUE`,
        [userId]
      );
      return result.rowCount ?? 0;
    },
    async rotateSession(id, refreshTokenHash, expiresAt) {
      const result = await pool.query(
        `UPDATE user_sessions
         SET refresh_token_hash = $2, rotated_at = CURRENT_TIMESTAMP, expires_at = $3
         WHERE id = $1 AND is_active = TRUE
         RETURNING *`,
        [id, refreshTokenHash, expiresAt]
      );
      return result.rows[0] ? toSession(result.rows[0]) : null;
    },
    async listPermissions() {
      return queryPermissions();
    },
    async findPermissionByKey(permissionKey) {
      const result = await pool.query(
        `SELECT id, permission_key, description, module, created_at
         FROM permissions
         WHERE permission_key = $1
         LIMIT 1`,
        [permissionKey]
      );

      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        permissionKey: String(row.permission_key) as RbacPermissionKey,
        description: row.description ? String(row.description) : "",
        module: row.module ? String(row.module) : "",
        createdAt: toIso(row.created_at as string | Date | null) ?? new Date().toISOString(),
      };
    },
    async listPermissionsForRole(role) {
      return queryPermissionsForRole(role);
    },
    async listPermissionsForUser(userId) {
      const result = await pool.query("SELECT role FROM users WHERE id = $1 LIMIT 1", [userId]);
      const role = result.rows[0]?.role ? (String(result.rows[0].role) as UserRole) : null;

      if (!role) {
        return [];
      }

      return queryPermissionsForRole(role);
    },
    async listRolePermissions(role) {
      const rows = await queryRolePermissions(role);

      if (rows.length) {
        return rows;
      }

      const fallbackRoles = role ? [role] : (Object.keys(RBAC_ROLE_PERMISSION_KEYS) as UserRole[]);

      return fallbackRoles.flatMap((fallbackRole) =>
        listRolePermissions(fallbackRole).map((permissionKey) => ({
          role: fallbackRole,
          permissionId: `fallback-${fallbackRole}-${permissionKey}`,
          permissionKey,
          description: null,
          module: null,
          createdAt: new Date().toISOString(),
        }))
      );
    },
    async replaceRolePermissions(role, permissionKeys) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM role_permissions WHERE role = $1", [role]);

        if (permissionKeys.length) {
          const placeholders = permissionKeys.map((_, index) => `$${index + 1}`).join(", ");
          const permissionsResult = await client.query(
            `SELECT id, permission_key FROM permissions WHERE permission_key IN (${placeholders})`,
            permissionKeys
          );

          const found = new Map(
            permissionsResult.rows.map((row: Record<string, unknown>) => [String(row.permission_key), String(row.id)])
          );

          for (const permissionKey of permissionKeys) {
            const permissionId = found.get(permissionKey);
            if (!permissionId) {
              continue;
            }

            await client.query(
              `INSERT INTO role_permissions (role, permission_id)
               VALUES ($1, $2)
               ON CONFLICT (role, permission_id) DO NOTHING`,
              [role, permissionId]
            );
          }
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return queryRolePermissions(role);
    },
    async findNomineeAssignment(customerId, nomineeUserId) {
      const result = await pool.query(
        `SELECT id, customer_id, nominee_user_id, status, relationship, email, mobile, full_name
         FROM nominees
         WHERE customer_id = $1 AND nominee_user_id = $2
         LIMIT 1`,
        [customerId, nomineeUserId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        customerId: String(row.customer_id),
        nomineeUserId: row.nominee_user_id ? String(row.nominee_user_id) : null,
        status: String(row.status),
        relationship: String(row.relationship),
        email: row.email ? String(row.email) : null,
        mobile: row.mobile ? String(row.mobile) : null,
        fullName: String(row.full_name),
      };
    },
    async createAuthToken(input) {
      const result = await pool.query(
        `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at, metadata)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [input.userId, input.tokenHash, input.purpose, input.expiresAt, input.metadata ?? {}]
      );
      return toToken(result.rows[0]);
    },
    async findAuthToken(tokenHash, purpose) {
      const result = await pool.query(
        `SELECT * FROM auth_tokens
         WHERE token_hash = $1 AND purpose = $2
         LIMIT 1`,
        [tokenHash, purpose]
      );
      return result.rows[0] ? toToken(result.rows[0]) : null;
    },
    async listAuthTokensByPurpose(userId, purpose) {
      const result = await pool.query(
        `SELECT *
         FROM auth_tokens
         WHERE user_id = $1 AND purpose = $2
         ORDER BY created_at DESC`,
        [userId, purpose]
      );
      return result.rows.map((row: Record<string, unknown>) => toToken(row));
    },
    async revokeAuthTokensByPurpose(userId, purpose) {
      const result = await pool.query(
        `UPDATE auth_tokens
         SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
         WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
        [userId, purpose]
      );
      return result.rowCount ?? 0;
    },
    async consumeAuthToken(id) {
      await pool.query("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    },
    async insertAuditLog(input) {
      await pool.query(
        `INSERT INTO audit_logs
          (user_id, role, action, module_name, entity_type, entity_id, old_value, new_value, ip_address, device_info)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          input.userId,
          input.role,
          input.action,
          input.moduleName,
          input.entityType,
          input.entityId,
          input.oldValue ?? null,
          input.newValue ?? null,
          input.ipAddress,
          input.deviceInfo,
        ]
      );
    },
    async insertSecurityEvent(input) {
      await pool.query(
        `INSERT INTO security_events
          (user_id, event_type, event_description, ip_address, device_info, risk_level, is_resolved)
         VALUES ($1,$2,$3,$4,$5,$6,FALSE)`,
        [
          input.userId,
          input.eventType,
          input.eventDescription,
          input.ipAddress,
          input.deviceInfo,
          input.riskLevel,
        ]
      );
    },
    async resolveSecurityEvent(id, userId) {
      const result = await pool.query(
        `UPDATE security_events
         SET is_resolved = TRUE
         WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2)
         RETURNING id`,
        [id, userId]
      );
      return Boolean(result.rows[0]);
    },
    async createNotification(input) {
      const status = input.status ?? "SENT";
      const sentAt = input.sentAt ?? (status === "SENT" ? new Date() : null);

      await pool.query(
        `INSERT INTO notifications (user_id, title, message, channel, status, sent_at, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          input.userId,
          input.title,
          input.message,
          input.channel ?? "IN_APP",
          status,
          sentAt,
          input.metadata ?? {},
        ]
      );
    },
    async countSecurityEvents(eventTypes, ipAddress, since, userId = null) {
      if (!ipAddress?.trim() && !userId) {
        return 0;
      }

      const result = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM security_events
         WHERE event_type = ANY($1::text[])
           AND created_at >= $2
           AND (
             ($4::uuid IS NOT NULL AND user_id = $4)
             OR ($4::uuid IS NULL AND $3::text IS NOT NULL AND ip_address = $3)
           )`,
        [eventTypes, since, ipAddress, userId]
      );
      return Number(result.rows[0]?.total ?? 0);
    },
  };
}
