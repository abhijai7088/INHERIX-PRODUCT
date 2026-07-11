import { backendJsonFetch } from "@/lib/auth-state";
import { parseBackendJsonResponse } from "@/lib/backend-api";

export type EventLogEntry = {
  id: string;
  domain: "audit" | "security" | "notification" | "session" | "compliance";
  type: string;
  title: string;
  summary: string;
  actor: string;
  actorRole: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN" | null;
  subject: string;
  details: string;
  device: string;
  location: string;
  outcome: "success" | "warning" | "failure" | "info";
  severity: "low" | "medium" | "high" | "critical";
  occurredAt: string;
  moduleName: string | null;
  entityType: string | null;
  entityId: string | null;
  source: string;
};

export type ComplianceReport = {
  id: string;
  title: string;
  description: string;
  scope: string;
  retention: string;
  format: "PDF" | "CSV" | "JSON";
  generatedBy: string;
  generatedAt: string;
  domain: "audit" | "security" | "notification" | "session" | "compliance";
};

export type AuditLogsPayload = {
  scope: "own" | "all";
  permissions?: string[];
  logs: EventLogEntry[];
  complianceReports: ComplianceReport[];
};

export type SecurityEventPayload = {
  scope: "own" | "all";
  events: EventLogEntry[];
};

export type SecuritySessionItem = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";
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

export type SecuritySessionPayload = {
  scope: "own" | "all";
  sessions: SecuritySessionItem[];
};

export type SecurityDeviceItem = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";
  deviceInfo: string | null;
  browserInfo: string | null;
  locationInfo: string | null;
  ipAddress: string | null;
  firstSeenAt: string;
  lastLoginAt: string;
  activeSessionCount: number;
  totalSessionCount: number;
  isActive: boolean;
};

export type SecurityDevicePayload = {
  scope: "own" | "all";
  devices: SecurityDeviceItem[];
};

export type NotificationItem = {
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
  actorRole: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN" | null;
};

export type NotificationPayload = {
  notifications: NotificationItem[];
  unreadCount: number;
  notificationsReadAt: number;
};

export type EventLogPayload = {
  scope: "own" | "all";
  events: EventLogEntry[];
  summary: {
    auditCount: number;
    securityCount: number;
    notificationCount: number;
    unreadCount: number;
  };
};

export type AdminDashboardPayload = {
  summary: {
    pendingTriggers: number;
    approvedTriggers: number;
    rejectedTriggers: number;
    recentReleases: number;
    securityAlerts: number;
    activeSessions: number;
    unreadNotifications: number;
  };
  health: Array<{
    label: string;
    description: string;
    status: "healthy" | "degraded" | "review";
  }>;
  alerts: string[];
  pendingTriggers: Array<{
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
  }>;
  recentReleases: Array<{
    id: string;
    triggerRequestId: string;
    customerId: string;
    nomineeId: string;
    nomineeName: string;
    nomineeUserId: string | null;
    documentId: string;
    documentTitle: string;
    fileName: string | null;
    fileType: string | null;
    fileSize: number | null;
    categoryId: string;
    categoryName: string;
    canView: boolean;
    canDownload: boolean;
    releaseStatus: string;
    releaseNotes: string | null;
    releasedBy: string | null;
    releasedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  securityAlerts: EventLogEntry[];
  recentAdminEvents: EventLogEntry[];
  readiness: {
    status: "ready" | "not_ready";
    databaseConfigured: boolean;
    storageConfigured: boolean;
    signingConfigured: boolean;
    kmsConfigured: boolean;
    notificationsConfigured: boolean;
    authConfigured: boolean;
    missingProductionSecrets: string[];
  };
};

export type AdminReportsPayload = {
  generatedAt: string;
  triggerReport: {
    title: string;
    description: string;
    availableFormats: Array<"PDF" | "CSV" | "XLSX">;
    rows: Array<{
      id: string;
      customerId: string;
      nomineeId: string;
      nomineeUserId: string | null;
      nomineeName: string;
      nomineeEmail: string | null;
      nomineeMobile: string | null;
      relationship: string;
      customRelationship: string | null;
      requestKind: string;
      subjectLine: string;
      summary: string;
      priority: string;
      status: string;
      submittedAt: string | null;
      reviewedAt: string | null;
      resolvedAt: string | null;
      cancelledAt: string | null;
      additionalInfoRequestedAt: string | null;
      additionalInfoReason: string | null;
      adminDecisionNote: string | null;
      latestActivityAt: string;
      createdAt: string;
      updatedAt: string;
      requestedByUserId: string | null;
      lastActionByUserId: string | null;
      lastActionByName: string | null;
      lastActionRole: string;
    }>;
  };
  releaseReport: {
    title: string;
    description: string;
    availableFormats: Array<"PDF" | "CSV" | "XLSX">;
    rows: Array<{
      id: string;
      triggerRequestId: string;
      customerId: string;
      nomineeId: string;
      nomineeName: string;
      nomineeUserId: string | null;
      documentId: string;
      documentTitle: string;
      fileName: string | null;
      fileType: string | null;
      fileSize: number | null;
      categoryId: string;
      categoryName: string;
      canView: boolean;
      canDownload: boolean;
      releaseStatus: string;
      releaseNotes: string | null;
      releasedBy: string | null;
      releasedAt: string | null;
      revokedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  auditReport: {
    title: string;
    description: string;
    availableFormats: Array<"PDF" | "CSV" | "XLSX">;
    rows: EventLogEntry[];
  };
};

export type AdminSettingsPayload = {
  groups: Array<{
    title: string;
    description: string;
    items: Array<{
      key: string;
      label: string;
      description: string;
      value: string;
      editableBy: "admin" | "super_admin";
      sensitive: boolean;
      source: string;
      lastUpdatedAt: string;
    }>;
  }>;
  admins: Array<{
    id: string;
    fullName: string;
    email: string;
    mobile: string | null;
    role: "ADMIN" | "SUPER_ADMIN";
    status: string;
    isEmailVerified: boolean;
    isMobileVerified: boolean;
    mfaEnabled: boolean;
    mustResetPassword: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
    activeSessionCount: number;
  }>;
  verificationOfficers: Array<{
    id: string;
    fullName: string;
    email: string;
    mobile: string | null;
    role: "VERIFICATION_OFFICER";
    status: string;
    isEmailVerified: boolean;
    isMobileVerified: boolean;
    mfaEnabled: boolean;
    mustResetPassword: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
    activeSessionCount: number;
  }>;
  recentChanges: EventLogEntry[];
  permissionMatrix: Array<{
    role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";
    permissions: string[];
    note: string;
  }>;
  readiness: {
    status: "ready" | "not_ready";
    databaseConfigured: boolean;
    storageConfigured: boolean;
    signingConfigured: boolean;
    kmsConfigured: boolean;
    notificationsConfigured: boolean;
    authConfigured: boolean;
    missingProductionSecrets: string[];
  };
};

export type BackupPayload = {
  schedule: string;
  retention: string;
  readiness: {
    status: "ready" | "not_ready";
    databaseConfigured: boolean;
    storageConfigured: boolean;
    signingConfigured: boolean;
    kmsConfigured: boolean;
    notificationsConfigured: boolean;
    authConfigured: boolean;
    missingProductionSecrets: string[];
  };
  artifacts: Array<{
    id: string;
    title: string;
    type: "backup" | "export";
    format: "ZIP" | "PDF" | "CSV" | "JSON";
    status: "ready" | "pending" | "scheduled" | "failed";
    generatedBy: string;
    createdAt: string;
    retention: string;
    downloadStatus: "signed" | "authenticated" | "pending" | "unavailable";
    source: string;
  }>;
  auditTrail: EventLogEntry[];
  alerts: string[];
};

export type GovernanceSnapshot = {
  summary: {
    activePolicies: number;
    reviewItems: number;
    riskFlags: number;
    adminActions: number;
    unreadNotifications: number;
    openSecurityEvents: number;
    activeSessions: number;
    pendingTriggers: number;
  };
  health: Array<{
    label: string;
    description: string;
    status: "healthy" | "degraded" | "review";
  }>;
  alerts: string[];
  metrics: Array<{
    label: string;
    value: string;
    delta: string;
    detail: string;
  }>;
  trend: Array<{
    label: string;
    activity: number;
    alerts: number;
    exports: number;
  }>;
  queue: Array<{
    id: string;
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    status: "approved" | "flagged" | "pending";
    module: string;
    dueAt: string;
  }>;
  actions: Array<{
    id: string;
    title: string;
    description: string;
    actor: string;
    status: "completed" | "monitoring" | "flagged";
    occurredAt: string;
  }>;
  policies: Array<{
    id: string;
    title: string;
    summary: string;
    owner: string;
    status: "active" | "review" | "restricted";
    updatedAt: string;
  }>;
  timeline: EventLogEntry[];
  retention: Array<{
    label: string;
    period: string;
    note: string;
  }>;
  permissionMatrix: Array<{
    role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";
    permissions: string[];
    note: string;
  }>;
  readiness: {
    status: "ready" | "not_ready";
    databaseConfigured: boolean;
    storageConfigured: boolean;
    signingConfigured: boolean;
    kmsConfigured: boolean;
    notificationsConfigured: boolean;
    authConfigured: boolean;
    missingProductionSecrets: string[];
  };
};

function readBackend<T>(response: Response, fallbackMessage: string) {
  return parseBackendJsonResponse<T>(response, fallbackMessage);
}

export async function getAuditLogs(limit = 25) {
  const response = await backendJsonFetch(`/audit-logs?limit=${encodeURIComponent(limit)}`);
  return readBackend<AuditLogsPayload>(response, "Unable to load audit logs.");
}

export async function getEventLog(limit = 25) {
  const response = await backendJsonFetch(`/event-log?limit=${encodeURIComponent(limit)}`);
  return readBackend<EventLogPayload>(response, "Unable to load event log.");
}

export async function getSecurityEvents(limit = 25) {
  const response = await backendJsonFetch(`/security/events?limit=${encodeURIComponent(limit)}`);
  return readBackend<SecurityEventPayload>(response, "Unable to load security events.");
}

export async function getSecuritySessions(limit = 25) {
  const response = await backendJsonFetch(`/security/sessions?limit=${encodeURIComponent(limit)}`);
  return readBackend<SecuritySessionPayload>(response, "Unable to load security sessions.");
}

export async function getSecurityDevices(limit = 25) {
  const response = await backendJsonFetch(`/security/devices?limit=${encodeURIComponent(limit)}`);
  return readBackend<SecurityDevicePayload>(response, "Unable to load security devices.");
}

export async function revokeSecurityDevice(deviceId: string) {
  const response = await backendJsonFetch("/security/devices/revoke", {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  });
  return readBackend<{ deviceId: string; revokedSessionCount: number }>(response, "Unable to revoke device.");
}

export async function getNotifications(limit = 25) {
  const response = await backendJsonFetch(`/notifications?limit=${encodeURIComponent(limit)}`);
  return readBackend<NotificationPayload>(response, "Unable to load notifications.");
}

export async function markNotificationRead(notificationId: string) {
  const response = await backendJsonFetch(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "POST",
  });
  return readBackend<{ notificationId: string }>(response, "Unable to mark notification as read.");
}

export async function markAllNotificationsRead() {
  const response = await backendJsonFetch("/notifications/read-all", {
    method: "POST",
  });
  return readBackend<{ updatedCount: number }>(response, "Unable to mark notifications as read.");
}

export async function getGovernanceSnapshot() {
  const response = await backendJsonFetch("/governance");
  return readBackend<{ dashboard: GovernanceSnapshot; complianceReports: ComplianceReport[] }>(
    response,
    "Unable to load governance snapshot."
  );
}

export async function getAdminDashboard() {
  const response = await backendJsonFetch("/admin/dashboard");
  return readBackend<AdminDashboardPayload>(response, "Unable to load admin dashboard.");
}

export async function getAdminReports() {
  const response = await backendJsonFetch("/admin/reports");
  return readBackend<AdminReportsPayload>(response, "Unable to load admin reports.");
}

export async function getAdminSettings() {
  const response = await backendJsonFetch("/admin/settings");
  return readBackend<AdminSettingsPayload>(response, "Unable to load admin settings.");
}

export async function updateAdminSettings(updates: Array<{ key: string; value: string }>) {
  const response = await backendJsonFetch("/admin/settings", {
    method: "POST",
    body: JSON.stringify({ updates }),
  });
  return readBackend<{ updatedCount: number }>(response, "Unable to update admin settings.");
}

export async function getAdminAccounts() {
  const response = await backendJsonFetch("/admin/admins");
  return readBackend<AdminSettingsPayload["admins"]>(response, "Unable to load admin accounts.");
}

export async function getVerificationOfficerAccounts() {
  const response = await backendJsonFetch("/admin/officers");
  return readBackend<AdminSettingsPayload["verificationOfficers"]>(response, "Unable to load verification officers.");
}

export async function createAdminAccount(input: { fullName: string; email: string; mobile: string | null; role: "ADMIN" | "SUPER_ADMIN" }) {
  const response = await backendJsonFetch("/admin/admins", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readBackend<{ userId: string; email: string; temporaryPassword: string; role: "ADMIN" | "SUPER_ADMIN" }>(
    response,
    "Unable to create admin account."
  );
}

export async function createVerificationOfficerAccount(input: {
  fullName: string;
  email: string;
  mobile: string | null;
  role?: "VERIFICATION_OFFICER";
}) {
  const response = await backendJsonFetch("/admin/officers", {
    method: "POST",
    body: JSON.stringify({ ...input, role: input.role ?? "VERIFICATION_OFFICER" }),
  });
  return readBackend<{ userId: string; email: string; temporaryPassword: string; role: "VERIFICATION_OFFICER" }>(
    response,
    "Unable to create verification officer account."
  );
}

export async function updateVerificationOfficerAccount(
  officerId: string,
  input: Partial<{
    fullName: string;
    mobile: string | null;
    status: string;
    isEmailVerified: boolean;
    isMobileVerified: boolean;
    mfaEnabled: boolean;
    mustResetPassword: boolean;
  }>
) {
  const response = await backendJsonFetch(`/admin/officers/${encodeURIComponent(officerId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return readBackend<{ userId: string; email: string }>(response, "Unable to update verification officer account.");
}

export async function resendVerificationEmail(officerId: string) {
  const response = await backendJsonFetch(`/admin/officers/${encodeURIComponent(officerId)}/resend-verification`, {
    method: "POST",
  });
  return readBackend<{ userId: string; email: string }>(response, "Unable to resend verification email.");
}

export async function reissueVerificationOfficerCredentials(officerId: string) {
  const response = await backendJsonFetch(`/admin/officers/${encodeURIComponent(officerId)}/reissue-credentials`, {
    method: "POST",
  });
  return readBackend<{ userId: string; email: string; temporaryPassword: string; role: "VERIFICATION_OFFICER" }>(
    response,
    "Unable to reissue officer credentials."
  );
}

export async function updateAdminAccount(
  adminId: string,
  input: Partial<{
    fullName: string;
    mobile: string | null;
    role: "ADMIN" | "SUPER_ADMIN";
    status: string;
    mfaEnabled: boolean;
    isEmailVerified: boolean;
    isMobileVerified: boolean;
  }>
) {
  const response = await backendJsonFetch(`/admin/admins/${encodeURIComponent(adminId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return readBackend<{ userId: string; email: string }>(response, "Unable to update admin account.");
}

export async function getBackupSnapshot() {
  const response = await backendJsonFetch("/admin/backup");
  return readBackend<BackupPayload>(response, "Unable to load backup snapshot.");
}

export async function downloadAuditLogsExport(params?: { action?: string; moduleName?: string; fromDate?: string; toDate?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.action) searchParams.set("action", params.action);
  if (params?.moduleName) searchParams.set("module", params.moduleName);
  if (params?.fromDate) searchParams.set("fromDate", params.fromDate);
  if (params?.toDate) searchParams.set("toDate", params.toDate);

  const response = await backendJsonFetch(`/audit-logs/export${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Unable to export audit logs.");
  }

  return response.text();
}
