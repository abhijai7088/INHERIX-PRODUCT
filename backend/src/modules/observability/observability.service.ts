import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { hashPassword } from "../../lib/password.js";
import { getReadinessPayload } from "../../routes/health.js";
import { HttpError } from "../../utils/http.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext, UserRole, UserStatus } from "../auth/types.js";
import { createEmailService } from "../email/email.service.js";
import { assertPermission, assertRole } from "../rbac/rbac.guard.js";
import {
  RBAC_PERMISSION_CATALOG,
  RBAC_ROLE_PERMISSION_KEYS,
} from "../rbac/permissions.js";
import { assertAnyPermission } from "../rbac/rbac.guard.js";
import type { ReleaseRecord } from "../release/types.js";
import type { TriggerRequestRecord } from "../trigger/types.js";
import type { ReleaseStore } from "../release/release.store.js";
import type { TriggerStore } from "../trigger/trigger.store.js";
import type {
  AuditLogRow,
  AdminUserRow,
  NotificationRow,
  PendingTriggerRow,
  PlatformSettingRow,
  SecurityEventRow,
  SessionRow,
  ObservabilityStore,
} from "./observability.store.js";

export type ObservabilityPrincipal = {
  user: {
    id: string;
    email: string;
    role: UserRole;
    fullName?: string;
  };
  session: { id: string } | null;
  accessToken: string;
  authenticatedBy: "access" | "refresh";
};

type ObservabilityStoreDependencies = ObservabilityStore &
  Pick<
    AuthStore,
    | "insertAuditLog"
    | "insertSecurityEvent"
    | "listPermissionsForUser"
    | "listRolePermissions"
    | "createAuthToken"
    | "findUserByEmail"
    | "findUserById"
    | "updateUser"
  > & {
    listRequestsForAdmin?: TriggerStore["listRequestsForAdmin"];
    listReleasesForAdmin?: ReleaseStore["listReleasesForAdmin"];
    listPlatformSettings: ObservabilityStore["listPlatformSettings"];
    upsertPlatformSetting: ObservabilityStore["upsertPlatformSetting"];
    listAdminUsers: ObservabilityStore["listAdminUsers"];
    listVerificationOfficers: ObservabilityStore["listVerificationOfficers"];
    createAdminUser: ObservabilityStore["createAdminUser"];
    updateAdminUser: ObservabilityStore["updateAdminUser"];
  };

type EventDomain = "audit" | "security" | "notification" | "session" | "compliance";

type EventOutcome = "success" | "warning" | "failure" | "info";
type EventSeverity = "low" | "medium" | "high" | "critical";

export type EventLogEntry = {
  id: string;
  domain: EventDomain;
  type: string;
  title: string;
  summary: string;
  actor: string;
  actorRole: UserRole | null;
  subject: string;
  details: string;
  device: string;
  location: string;
  outcome: EventOutcome;
  severity: EventSeverity;
  occurredAt: string;
  moduleName: string | null;
  entityType: string | null;
  entityId: string | null;
  source: string;
};

export type SecurityDeviceRecord = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
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

export type ComplianceReport = {
  id: string;
  title: string;
  description: string;
  scope: string;
  retention: string;
  format: "PDF" | "CSV" | "JSON";
  generatedBy: string;
  generatedAt: string;
  domain: EventDomain;
};

type GovernanceSummary = {
  activePolicies: number;
  reviewItems: number;
  riskFlags: number;
  adminActions: number;
  unreadNotifications: number;
  openSecurityEvents: number;
  activeSessions: number;
  pendingTriggers: number;
};

type GovernanceHealthItem = {
  label: string;
  description: string;
  status: "healthy" | "degraded" | "review";
};

type GovernanceMetricItem = {
  label: string;
  value: string;
  delta: string;
  detail: string;
};

type GovernanceTrendPoint = {
  label: string;
  activity: number;
  alerts: number;
  exports: number;
};

type GovernanceQueueItem = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "approved" | "flagged" | "pending";
  module: string;
  dueAt: string;
};

type GovernanceActionItem = {
  id: string;
  title: string;
  description: string;
  actor: string;
  status: "completed" | "monitoring" | "flagged";
  occurredAt: string;
};

type GovernancePolicyItem = {
  id: string;
  title: string;
  summary: string;
  owner: string;
  status: "active" | "review" | "restricted";
  updatedAt: string;
};

type GovernanceSnapshot = {
  summary: GovernanceSummary;
  health: GovernanceHealthItem[];
  alerts: string[];
  metrics: GovernanceMetricItem[];
  trend: GovernanceTrendPoint[];
  queue: GovernanceQueueItem[];
  actions: GovernanceActionItem[];
  policies: GovernancePolicyItem[];
  timeline: EventLogEntry[];
  retention: Array<{
    label: string;
    period: string;
    note: string;
  }>;
  permissionMatrix: Array<{
    role: UserRole;
    permissions: string[];
    note: string;
  }>;
  readiness: ReturnType<typeof getReadinessPayload>;
};

type AdminDashboardSnapshot = {
  summary: {
    pendingTriggers: number;
    approvedTriggers: number;
    rejectedTriggers: number;
    recentReleases: number;
    securityAlerts: number;
    activeSessions: number;
    unreadNotifications: number;
  };
  health: GovernanceHealthItem[];
  alerts: string[];
  pendingTriggers: PendingTriggerRow[];
  recentReleases: ReleaseRecord[];
  securityAlerts: EventLogEntry[];
  recentAdminEvents: EventLogEntry[];
  readiness: ReturnType<typeof getReadinessPayload>;
};

type AdminTriggerReport = {
  title: string;
  description: string;
  availableFormats: Array<"PDF" | "CSV" | "XLSX">;
  rows: TriggerRequestRecord[];
};

type AdminReleaseReport = {
  title: string;
  description: string;
  availableFormats: Array<"PDF" | "CSV" | "XLSX">;
  rows: ReleaseRecord[];
};

type AdminAuditReport = {
  title: string;
  description: string;
  availableFormats: Array<"PDF" | "CSV" | "XLSX">;
  rows: EventLogEntry[];
};

type AdminReportsSnapshot = {
  generatedAt: string;
  triggerReport: AdminTriggerReport;
  releaseReport: AdminReleaseReport;
  auditReport: AdminAuditReport;
};

type AdminSettingItem = {
  key: string;
  label: string;
  description: string;
  value: string;
  editableBy: "admin" | "super_admin";
  sensitive: boolean;
  source: string;
  lastUpdatedAt: string;
};

type AdminSettingGroup = {
  title: string;
  description: string;
  items: AdminSettingItem[];
};

type AdminSettingsSnapshot = {
  groups: AdminSettingGroup[];
  admins: AdminUserRow[];
  verificationOfficers: AdminUserRow[];
  recentChanges: EventLogEntry[];
  permissionMatrix: GovernanceSnapshot["permissionMatrix"];
  readiness: ReturnType<typeof getReadinessPayload>;
};

type PrivilegedCreateResponse = {
  userId: string;
  email: string;
  temporaryPassword: string;
  role: "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";
};

type PrivilegedAccountActionResponse = {
  userId: string;
  email: string;
};

type BackupArtifact = {
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
};

type BackupSnapshot = {
  schedule: string;
  retention: string;
  readiness: ReturnType<typeof getReadinessPayload>;
  artifacts: BackupArtifact[];
  auditTrail: EventLogEntry[];
  alerts: string[];
};

type SettingCatalogItem = Omit<AdminSettingItem, "value" | "lastUpdatedAt"> & {
  groupTitle: string;
  defaultValue: string;
};

const ADMIN_SETTING_CATALOG: SettingCatalogItem[] = [
  {
    groupTitle: "Platform identity",
    key: "platform_name",
    label: "Platform name",
    description: "Visible in headers, notifications and exports.",
    defaultValue: "INHERIX",
    editableBy: "super_admin",
    sensitive: false,
    source: "application branding",
  },
  {
    groupTitle: "Platform identity",
    key: "support_email",
    label: "Support email",
    description: "Primary support mailbox used in admin contact surfaces.",
    defaultValue: "support@inherix.local",
    editableBy: "super_admin",
    sensitive: true,
    source: "seed",
  },
  {
    groupTitle: "Security",
    key: "privileged_mfa_enforced",
    label: "Privileged MFA enforcement",
    description: "Require a second verification step for admin and super admin sign-in.",
    defaultValue: "true",
    editableBy: "super_admin",
    sensitive: true,
    source: "seed",
  },
  {
    groupTitle: "Security",
    key: "session_idle_timeout_minutes",
    label: "Session idle timeout",
    description: "Recommended refresh lifetime for authenticated sessions.",
    defaultValue: "30",
    editableBy: "super_admin",
    sensitive: true,
    source: "seed",
  },
  {
    groupTitle: "Notifications",
    key: "notification_from_name",
    label: "Notification sender name",
    description: "Displayed on security and workflow notifications.",
    defaultValue: "INHERIX Operations",
    editableBy: "super_admin",
    sensitive: false,
    source: "seed",
  },
  {
    groupTitle: "System behavior",
    key: "maintenance_mode",
    label: "Maintenance mode",
    description: "When enabled, non-privileged experiences should present a maintenance state.",
    defaultValue: "false",
    editableBy: "admin",
    sensitive: true,
    source: "seed",
  },
  {
    groupTitle: "Delivery",
    key: "email_provider",
    label: "Email provider",
    description: "Current delivery backend for invitations and workflow notifications.",
    defaultValue: "development",
    editableBy: "admin",
    sensitive: false,
    source: "runtime",
  },
  {
    groupTitle: "Retention",
    key: "backup_schedule",
    label: "Backup schedule",
    description: "Backup cadence required by the product documentation.",
    defaultValue: "Daily 02:00 IST",
    editableBy: "super_admin",
    sensitive: true,
    source: "product documentation",
  },
  {
    groupTitle: "Retention",
    key: "audit_retention",
    label: "Audit retention",
    description: "Append-only audit retention window.",
    defaultValue: "7 years",
    editableBy: "super_admin",
    sensitive: true,
    source: "compliance",
  },
  {
    groupTitle: "Retention",
    key: "notification_retention",
    label: "Notification retention",
    description: "Notification history retention for delivery review.",
    defaultValue: "12 months",
    editableBy: "super_admin",
    sensitive: false,
    source: "compliance",
  },
];

function readSettingValue(value: Record<string, unknown> | null | undefined, fallback: string) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const raw = value.value ?? value.default ?? value.current;
  if (raw === undefined || raw === null) {
    return fallback;
  }

  if (typeof raw === "boolean" || typeof raw === "number") {
    return String(raw);
  }

  return String(raw);
}

function groupSettingsByCatalog(
  readiness: ReturnType<typeof getReadinessPayload>,
  storedSettings: PlatformSettingRow[]
): AdminSettingGroup[] {
  const settingsByKey = new Map(storedSettings.map((setting) => [setting.settingKey, setting]));
  const groups = new Map<string, AdminSettingGroup>();
  const now = new Date().toISOString();

  for (const catalogItem of ADMIN_SETTING_CATALOG) {
    const existingGroup = groups.get(catalogItem.groupTitle) ?? {
      title: catalogItem.groupTitle,
      description:
        catalogItem.groupTitle === "Security"
          ? "Authentication and session controls backed by the live configuration store."
          : catalogItem.groupTitle === "Retention"
            ? "Operational cadence and retention windows surfaced from the live readiness model."
            : catalogItem.groupTitle === "Delivery"
              ? "Outbound delivery and messaging controls."
              : catalogItem.groupTitle === "System behavior"
                ? "Runtime switches that influence the operator experience."
                : "Brand, runtime and deployment identity shown across the admin surfaces.",
      items: [],
    };

    const stored = settingsByKey.get(catalogItem.key);
    const value = stored ? readSettingValue(stored.value, catalogItem.defaultValue) : catalogItem.defaultValue;
    existingGroup.items.push({
      key: catalogItem.key,
      label: catalogItem.label,
      description: catalogItem.description,
      value,
      editableBy: catalogItem.editableBy,
      sensitive: catalogItem.sensitive,
      source: stored?.source ?? catalogItem.source,
      lastUpdatedAt: stored?.updatedAt ?? now,
    });
    groups.set(catalogItem.groupTitle, existingGroup);
  }

  if (readiness.status !== "ready") {
    const securityGroup = groups.get("Security");
    if (securityGroup) {
      securityGroup.items.unshift({
        key: "environment_status",
        label: "Environment status",
        description: "Deployment readiness snapshot derived from the backend environment.",
        value: readiness.status === "ready" ? "Ready" : "Review",
        editableBy: "super_admin",
        sensitive: true,
        source: "readiness",
        lastUpdatedAt: now,
      });
    }
  }

  return [...groups.values()];
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function humanizeAction(action: string) {
  return titleCase(action.replace(/_/g, " "));
}

function toEventSeverity(value: "LOW" | "MEDIUM" | "HIGH"): EventSeverity {
  if (value === "HIGH") {
    return "high";
  }

  if (value === "MEDIUM") {
    return "medium";
  }

  return "low";
}

function toEventOutcome(severity: EventSeverity, isResolved: boolean, statusHint?: string | null): EventOutcome {
  if (statusHint && /failed|rejected|forbidden|denied/i.test(statusHint)) {
    return "failure";
  }

  if (severity === "high" && !isResolved) {
    return "warning";
  }

  if (severity === "critical") {
    return isResolved ? "warning" : "failure";
  }

  return "success";
}

function deriveAuditDomain(moduleName: string | null, action: string): EventDomain {
  const normalizedModule = moduleName?.toLowerCase() ?? "";
  const normalizedAction = action.toUpperCase();

  if (normalizedModule === "rbac" || normalizedModule === "backup") {
    return "compliance";
  }

  if (normalizedModule === "auth") {
    if (
      normalizedAction.includes("LOGIN") ||
      normalizedAction.includes("LOGOUT") ||
      normalizedAction.includes("TOKEN") ||
      normalizedAction.includes("SESSION") ||
      normalizedAction.includes("PASSWORD") ||
      normalizedAction.includes("EMAIL")
    ) {
      return "session";
    }

    return "security";
  }

  if (normalizedModule === "release") {
    return "notification";
  }

  if (normalizedModule === "nominee" || normalizedModule === "trigger") {
    return "audit";
  }

  return "audit";
}

function deriveAuditSeverity(moduleName: string | null, action: string): EventSeverity {
  const normalizedModule = moduleName?.toLowerCase() ?? "";
  const normalizedAction = action.toUpperCase();

  if (normalizedModule === "rbac" || normalizedAction.includes("DENIED") || normalizedAction.includes("FAILED")) {
    return "high";
  }

  if (normalizedModule === "release" || normalizedModule === "trigger" || normalizedModule === "nominee") {
    return "medium";
  }

  return "low";
}

function deriveNotificationCategory(metadata: Record<string, unknown>) {
  const category = typeof metadata.category === "string" ? metadata.category : "workflow";
  if (category === "security" || category === "release" || category === "compliance" || category === "audit") {
    return category as EventDomain;
  }

  return "audit";
}

function mapAuditRow(row: AuditLogRow, scope: "own" | "all"): EventLogEntry {
  const domain = deriveAuditDomain(row.moduleName, row.action);
  const severity = deriveAuditSeverity(row.moduleName, row.action);
  const actor = row.actorName ?? row.actorEmail ?? "System";

  return {
    id: row.id,
    domain,
    type: row.action,
    title: humanizeAction(row.action),
    summary: `${actor} recorded ${row.entityType ?? "an event"} in ${row.moduleName ?? "system"}${scope === "own" ? " for your account" : ""}.`,
    actor,
    actorRole: row.role,
    subject: row.entityType ?? "record",
    details: row.entityId ?? "No entity id",
    device: row.deviceInfo ?? "Unknown device",
    location: row.ipAddress ?? "Unknown location",
    outcome: toEventOutcome(severity, true, row.action),
    severity,
    occurredAt: row.createdAt,
    moduleName: row.moduleName,
    entityType: row.entityType,
    entityId: row.entityId,
    source: row.moduleName ? titleCase(row.moduleName) : "System",
  };
}

function mapSecurityEvent(row: SecurityEventRow, scope: "own" | "all"): EventLogEntry {
  const severity = toEventSeverity(row.riskLevel);
  const actor = row.actorName ?? row.actorEmail ?? "System";

  return {
    id: row.id,
    domain: "security",
    type: row.eventType,
    title: humanizeAction(row.eventType),
    summary: row.eventDescription ?? `${row.eventType} was recorded.`,
    actor,
    actorRole: null,
    subject: row.eventType,
    details: row.eventDescription ?? "No additional details",
    device: row.deviceInfo ?? "Unknown device",
    location: row.ipAddress ?? "Unknown location",
    outcome: toEventOutcome(severity, row.isResolved, row.eventType),
    severity,
    occurredAt: row.createdAt,
    moduleName: "security",
    entityType: "security_event",
    entityId: row.id,
    source: scope === "all" ? "Security Center" : "My security",
  };
}

function mapSessionRow(row: SessionRow) {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    ipAddress: row.ipAddress,
    deviceInfo: row.deviceInfo,
    browserInfo: row.browserInfo,
    locationInfo: row.locationInfo,
    isActive: row.isActive,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    rotatedAt: row.rotatedAt,
  };
}

function buildDeviceSignature(row: SessionRow) {
  return [
    row.userId,
    row.deviceInfo ?? "",
    row.browserInfo ?? "",
    row.locationInfo ?? "",
  ].join("|");
}

function buildDeviceRecord(sessions: SessionRow[]): SecurityDeviceRecord {
  const latest = sessions[0];
  const earliest = sessions[sessions.length - 1] ?? latest;
  const activeSessionCount = sessions.filter((item) => item.isActive).length;
  const totalSessionCount = sessions.length;

  return {
    id: sha256Hex(buildDeviceSignature(latest)),
    userId: latest.userId,
    fullName: latest.fullName,
    email: latest.email,
    role: latest.role,
    deviceInfo: latest.deviceInfo,
    browserInfo: latest.browserInfo,
    locationInfo: latest.locationInfo,
    ipAddress: latest.ipAddress,
    firstSeenAt: earliest.createdAt,
    lastLoginAt: latest.createdAt,
    activeSessionCount,
    totalSessionCount,
    isActive: activeSessionCount > 0,
  };
}

function deriveSecurityDevices(sessions: SessionRow[]) {
  if (!sessions.length) {
    return [];
  }

  const groups = new Map<string, SessionRow[]>();

  for (const session of sessions) {
    const signature = buildDeviceSignature(session);
    const group = groups.get(signature) ?? [];
    group.push(session);
    groups.set(signature, group);
  }

  return [...groups.values()]
    .map((group) => buildDeviceRecord(group))
    .sort((left, right) => right.lastLoginAt.localeCompare(left.lastLoginAt));
}

function mapNotification(row: NotificationRow): EventLogEntry {
  const metadata = row.metadata ?? {};
  const category = deriveNotificationCategory(metadata);
  const severity = (typeof metadata.priority === "string" && metadata.priority.toLowerCase() === "high")
    ? "high"
    : typeof metadata.priority === "string" && metadata.priority.toLowerCase() === "medium"
      ? "medium"
      : "low";
  const actor = row.actorName ?? "System";

  return {
    id: row.id,
    domain: category,
    type: `notification:${row.status.toLowerCase()}`,
    title: row.title,
    summary: row.message,
    actor,
    actorRole: row.actorRole,
    subject: typeof metadata.source === "string" ? metadata.source : "Notification",
    details: typeof metadata.actionLabel === "string" ? metadata.actionLabel : row.channel,
    device: row.channel,
    location: row.readAt ? "Read" : "Unread",
    outcome: row.status === "FAILED" ? "failure" : row.readAt ? "success" : "info",
    severity,
    occurredAt: row.sentAt ?? row.createdAt,
    moduleName: "notifications",
    entityType: "notification",
    entityId: row.id,
    source: typeof metadata.source === "string" ? metadata.source : "Notifications",
  };
}

function sortAndTrim(entries: EventLogEntry[], limit: number) {
  return entries.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, limit);
}

function makeComplianceReports(now = new Date()): ComplianceReport[] {
  return [
    {
      id: "audit-retention",
      title: "Audit trail export",
      description: "Immutable audit logs packaged for oversight and long-term retention.",
      scope: "Audit, workflow and access events",
      retention: "7 years",
      format: "PDF",
      generatedBy: "INHERIX Compliance",
      generatedAt: now.toISOString(),
      domain: "compliance",
    },
    {
      id: "security-retention",
      title: "Security event record",
      description: "Security events and incident traces with role-aware visibility.",
      scope: "Login, device trust and anomaly events",
      retention: "7 years",
      format: "CSV",
      generatedBy: "Security Center",
      generatedAt: now.toISOString(),
      domain: "security",
    },
    {
      id: "notification-retention",
      title: "Notification ledger",
      description: "Notification history used for delivery review and audit validation.",
      scope: "In-app, email and release notifications",
      retention: "12 months",
      format: "JSON",
      generatedBy: "Notification Service",
      generatedAt: now.toISOString(),
      domain: "notification",
    },
  ];
}

function pickQueuePriority(priority: string): GovernanceQueueItem["priority"] {
  const normalized = priority.toLowerCase();
  if (normalized.includes("high") || normalized.includes("critical")) {
    return "high";
  }

  if (normalized.includes("medium")) {
    return "medium";
  }

  return "low";
}

function buildTrendPoints(events: EventLogEntry[]): GovernanceTrendPoint[] {
  const buckets = new Map<string, { activity: number; alerts: number; exports: number }>();
  const now = new Date();

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { activity: 0, alerts: 0, exports: 0 });
  }

  for (const event of events) {
    const key = event.occurredAt.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }

    bucket.activity += 1;
    if (event.domain === "security" && (event.severity === "high" || event.outcome === "warning" || event.outcome === "failure")) {
      bucket.alerts += 1;
    }
    if (event.domain === "compliance") {
      bucket.exports += 1;
    }
  }

  return [...buckets.entries()].map(([label, value]) => ({
    label: new Date(`${label}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short" }),
    activity: value.activity,
    alerts: value.alerts,
    exports: value.exports,
  }));
}

export function createObservabilityService(
  env: AppEnv,
  logger: Logger,
  store: ObservabilityStoreDependencies
) {
  logger.debug("Observability service initialized", { module: "observability" });
  const emailService = createEmailService(env, logger);

  async function getPermissions(userId: string) {
    const permissions = await store.listPermissionsForUser(userId);
    return permissions.length ? permissions : [];
  }

  function isAdminPermissionScope(permissions: ReadonlyArray<string>) {
    return permissions.includes("ADMIN_VIEW_AUDIT_LOG") || permissions.includes("SUPER_ADMIN_VIEW_SYSTEM_AUDIT");
  }

  function isSecurityPermissionScope(permissions: ReadonlyArray<string>) {
    return permissions.includes("ADMIN_VIEW_SECURITY_EVENTS") || permissions.includes("SUPER_ADMIN_VIEW_SYSTEM_AUDIT");
  }

  function isGovernanceScope(permissions: ReadonlyArray<string>) {
    return permissions.includes("SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS");
  }

  function buildAdminSettingGroups(readiness: ReturnType<typeof getReadinessPayload>, settings: PlatformSettingRow[]): AdminSettingGroup[] {
    return groupSettingsByCatalog(readiness, settings);
  }

  function canEditSetting(permissions: ReadonlyArray<string>, setting: SettingCatalogItem) {
    if (setting.editableBy === "admin") {
      return permissions.includes("ADMIN_MANAGE_USERS_LIMITED") || permissions.includes("SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS");
    }

    return permissions.includes("SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS");
  }

  function normalizeAdminRole(role: string): UserRole | null {
    const candidate = role.trim().toUpperCase() as UserRole;
    return candidate === "ADMIN" || candidate === "SUPER_ADMIN" ? candidate : null;
  }

  function normalizePrivilegedCreateRole(role: string): PrivilegedCreateResponse["role"] | null {
    const candidate = role.trim().toUpperCase() as PrivilegedCreateResponse["role"];
    return candidate === "VERIFICATION_OFFICER" || candidate === "ADMIN" || candidate === "SUPER_ADMIN" ? candidate : null;
  }

  function buildBackupArtifacts(reports: ComplianceReport[], readiness: ReturnType<typeof getReadinessPayload>): BackupArtifact[] {
    const timestamp = new Date().toISOString();

    return [
      ...reports.map((report) => ({
        id: report.id,
        title: report.title,
        type: "export" as const,
        format: report.format,
        status: readiness.storageConfigured ? ("ready" as const) : ("pending" as const),
        generatedBy: report.generatedBy,
        createdAt: report.generatedAt,
        retention: report.retention,
        downloadStatus: readiness.storageConfigured ? ("signed" as const) : ("unavailable" as const),
        source: report.domain,
      })),
      {
        id: "backup-posture",
        title: "Daily continuity backup",
        type: "backup",
        format: "ZIP",
        status: readiness.storageConfigured ? "scheduled" : "pending",
        generatedBy: "System scheduler",
        createdAt: timestamp,
        retention: "365 days",
        downloadStatus: readiness.storageConfigured ? "authenticated" : "unavailable",
        source: "backup policy",
      },
    ];
  }

  function buildBackupAlerts(readiness: ReturnType<typeof getReadinessPayload>, auditTrail: EventLogEntry[]) {
    const alerts: string[] = [];
    if (!readiness.databaseConfigured) alerts.push("Database configuration is missing.");
    if (!readiness.storageConfigured) alerts.push("Secure storage is not configured.");
    if (!readiness.notificationsConfigured) alerts.push("Notification delivery is not configured.");
    if (!auditTrail.length) alerts.push("No backup-related audit trail is available yet.");
    return alerts;
  }

  async function buildScopedAuditLogs(principal: ObservabilityPrincipal, limit = 25) {
    const permissions = await getPermissions(principal.user.id);
    const canViewAll = isAdminPermissionScope(permissions);
    const auditLogs = await store.listAuditLogs({
      userId: canViewAll ? null : principal.user.id,
      limit,
    });

    const scope: "own" | "all" = canViewAll ? "all" : "own";

    return {
      scope,
      permissions,
      logs: auditLogs.map((row) => mapAuditRow(row, scope)),
    };
  }

  async function buildSecurityEvents(principal: ObservabilityPrincipal, limit = 25) {
    const permissions = await getPermissions(principal.user.id);
    assertPermission(permissions, "ADMIN_VIEW_SECURITY_EVENTS", "You are not allowed to view security events.");

    const canViewAll = isSecurityPermissionScope(permissions);
    const events = await store.listSecurityEvents({
      userId: canViewAll ? null : principal.user.id,
      limit,
    });

    return {
      scope: canViewAll ? "all" : "own",
      events: events.map((row) => mapSecurityEvent(row, canViewAll ? "all" : "own")),
    };
  }

  async function buildSecuritySessions(principal: ObservabilityPrincipal, limit = 25) {
    const permissions = await getPermissions(principal.user.id);
    assertPermission(permissions, "ADMIN_VIEW_SECURITY_EVENTS", "You are not allowed to view security sessions.");

    const canViewAll = isSecurityPermissionScope(permissions);
    const sessions = await store.listSessions({
      userId: canViewAll ? null : principal.user.id,
      limit,
    });

    return {
      scope: canViewAll ? "all" : "own",
      sessions: sessions.map((row) => mapSessionRow(row)),
    };
  }

  async function buildSecurityDevices(principal: ObservabilityPrincipal, limit = 25) {
    const permissions = await getPermissions(principal.user.id);
    assertPermission(permissions, "ADMIN_VIEW_SECURITY_EVENTS", "You are not allowed to view login devices.");

    const canViewAll = isSecurityPermissionScope(permissions);
    const sessions = await store.listSessions({
      userId: canViewAll ? null : principal.user.id,
      limit: Math.min(Math.max(limit * 4, limit, 50), 100),
    });
    const devices = deriveSecurityDevices(sessions);

    return {
      scope: canViewAll ? "all" : "own",
      devices: devices.slice(0, limit),
    };
  }

  async function buildNotifications(principal: ObservabilityPrincipal, limit = 25) {
    const notifications = await store.listNotifications({ userId: principal.user.id, limit });
    const unreadCount = await store.countUnreadNotifications(principal.user.id);

    return {
      notifications,
      unreadCount,
      notificationsReadAt: notifications.filter((item) => item.readAt).length,
    };
  }

  async function buildEventLog(principal: ObservabilityPrincipal, limit = 25) {
    const [audit, notifications, permissions] = await Promise.all([
      buildScopedAuditLogs(principal, limit),
      buildNotifications(principal, limit),
      getPermissions(principal.user.id),
    ]);

    const canViewAllSecurity = isSecurityPermissionScope(permissions);
    const securityEvents = await store.listSecurityEvents({
      userId: canViewAllSecurity ? null : principal.user.id,
      limit,
    });

    const combined = [
      ...audit.logs,
      ...securityEvents.map((row) => mapSecurityEvent(row, canViewAllSecurity ? "all" : "own")),
      ...notifications.notifications.map((row) => mapNotification(row)),
    ];

    return {
      scope: audit.scope,
      events: sortAndTrim(combined, limit),
      summary: {
        auditCount: audit.logs.length,
        securityCount: securityEvents.length,
        notificationCount: notifications.notifications.length,
        unreadCount: notifications.unreadCount,
      },
    };
  }

  async function buildGovernanceSnapshot(principal: ObservabilityPrincipal): Promise<GovernanceSnapshot> {
    const permissions = await getPermissions(principal.user.id);
    const canViewGovernance =
      permissions.includes("SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS") ||
      permissions.includes("ADMIN_VIEW_TRIGGER_QUEUE") ||
      permissions.includes("ADMIN_MANAGE_USERS_LIMITED");

    if (!canViewGovernance) {
      throw new HttpError(403, "FORBIDDEN", "You are not allowed to view governance data.");
    }

    const readiness = getReadinessPayload(env);
      const rolePermissionMappings = await store.listRolePermissions();
    const auditLogs = await store.listAuditLogs({ userId: null, limit: 50 });
    const securityEvents = await store.listSecurityEvents({ userId: null, limit: 25 });
    const pendingTriggers = await store.listPendingTriggerRequests(8);
    const activeSessions = await store.countSessions(null, true);
    const unreadNotifications = await store.countUnreadNotifications(principal.user.id);
    const openSecurityEvents = await store.countSecurityEvents(null, undefined, true);
    const failedNotifications = await store.listNotifications({ userId: principal.user.id, limit: 50 });
    const recentEvents = sortAndTrim(
      [
        ...auditLogs.map((row) => mapAuditRow(row, "all")),
        ...securityEvents.map((row) => mapSecurityEvent(row, "all")),
      ],
      12
    );
    const trend = buildTrendPoints(recentEvents);

    const securityFlags = securityEvents.filter((item) => !item.isResolved && item.riskLevel !== "LOW").length;
    const reviewItems = securityFlags + pendingTriggers.length;

    const policyState = rolePermissionMappings.length ? "active" : "review";
    const policies: GovernancePolicyItem[] = [
      {
        id: "role-boundaries",
        title: "Role boundaries",
        summary: "Access is governed by explicit role permissions and route guards.",
        owner: "RBAC",
        status: policyState,
        updatedAt: auditLogs[0]?.createdAt ?? new Date().toISOString(),
      },
      {
        id: "audit-retention",
        title: "Audit retention",
        summary: "Audit logs are retained for seven years with append-only write paths.",
        owner: "Compliance",
        status: "active",
        updatedAt: readiness.status === "ready" ? new Date().toISOString() : auditLogs[0]?.createdAt ?? new Date().toISOString(),
      },
      {
        id: "notification-delivery",
        title: "Notification delivery",
        summary: "Workflow and release notifications flow through the live notification ledger.",
        owner: "Operations",
        status: failedNotifications.some((item) => item.status === "FAILED") ? "review" : "active",
        updatedAt: failedNotifications[0]?.createdAt ?? new Date().toISOString(),
      },
      {
        id: "security-observability",
        title: "Security observability",
        summary: "Security events and sessions are monitored by the control plane.",
        owner: "Security",
        status: securityFlags > 0 ? "review" : "active",
        updatedAt: securityEvents[0]?.createdAt ?? new Date().toISOString(),
      },
      {
        id: "system-settings",
        title: "System settings",
        summary: "Global settings remain restricted to super admin oversight.",
        owner: "Super admin",
        status: "restricted",
        updatedAt: new Date().toISOString(),
      },
    ];

    const alerts: string[] = [];
    if (!readiness.databaseConfigured) alerts.push("Database configuration is missing.");
    if (!readiness.storageConfigured) alerts.push("Secure storage is not configured.");
    if (!readiness.notificationsConfigured) alerts.push("Notification delivery is not configured.");
    if (failedNotifications.some((item) => item.status === "FAILED")) alerts.push("One or more notifications failed to deliver.");
    if (securityFlags > 0) alerts.push(`${securityFlags} security events require review.`);
    if (pendingTriggers.length > 0) alerts.push(`${pendingTriggers.length} trigger requests are awaiting operator attention.`);

    const metrics: GovernanceMetricItem[] = [
      { label: "Audit coverage", value: `${auditLogs.length}`, delta: `${Math.max(auditLogs.length - 5, 0)} more`, detail: "Recent audit entries in scope" },
      { label: "Security events", value: `${securityEvents.length}`, delta: securityFlags > 0 ? "needs review" : "stable", detail: "Latest security posture" },
      { label: "Open triggers", value: `${pendingTriggers.length}`, delta: pendingTriggers.length ? "queue active" : "clear", detail: "Pending release review items" },
      { label: "Unread notifications", value: `${unreadNotifications}`, delta: unreadNotifications ? "attention needed" : "clear", detail: "Current notification backlog" },
    ];

    const health: GovernanceHealthItem[] = [
      {
        label: "Database",
        description: "Primary data store is connected and serving read models.",
        status: readiness.databaseConfigured ? "healthy" : "degraded",
      },
      {
        label: "Storage",
        description: "Encrypted object storage is available for continuity workflows.",
        status: readiness.storageConfigured ? "healthy" : "degraded",
      },
      {
        label: "Notifications",
        description: "Notification ledger writes and read markers are active.",
        status: readiness.notificationsConfigured ? "healthy" : "review",
      },
      {
        label: "RBAC",
        description: `${Object.keys(RBAC_ROLE_PERMISSION_KEYS).length} roles and ${RBAC_PERMISSION_CATALOG.length} permissions mapped.`,
        status: rolePermissionMappings.length ? "healthy" : "review",
      },
    ];

  const queue: GovernanceQueueItem[] = [
    ...pendingTriggers.slice(0, 4).map((item) => ({
        id: `trigger-${item.id}`,
        title: item.subjectLine,
        description: `${item.nomineeName} - ${item.requestKind} request is ${item.status.toLowerCase()}.`,
        priority: pickQueuePriority(item.priority) as GovernanceQueueItem["priority"],
        status: item.status === "PENDING" ? ("pending" as const) : ("flagged" as const),
        module: "Trigger queue",
        dueAt: item.latestActivityAt,
      })),
      ...securityEvents
        .filter((item) => !item.isResolved)
        .slice(0, 2)
        .map((item) => ({
          id: `security-${item.id}`,
          title: item.eventType,
          description: item.eventDescription ?? "Security event requires review.",
          priority: (item.riskLevel === "HIGH" ? "high" : "medium") as GovernanceQueueItem["priority"],
          status: "flagged" as const,
          module: "Security center",
          dueAt: item.createdAt,
        })),
    ].slice(0, 6);

    const actions: GovernanceActionItem[] = recentEvents.slice(0, 6).map((event) => ({
      id: event.id,
      title: event.title,
      description: event.summary,
      actor: event.actor,
      status: event.outcome === "success" ? "completed" : "monitoring",
      occurredAt: event.occurredAt,
    }));

    const timeline = recentEvents.slice(0, 8);

    return {
      summary: {
        activePolicies: policies.filter((policy) => policy.status === "active").length,
        reviewItems,
        riskFlags: securityFlags,
        adminActions: actions.length,
        unreadNotifications,
        openSecurityEvents,
        activeSessions,
        pendingTriggers: pendingTriggers.length,
      },
      health,
      alerts,
      metrics,
      trend,
      queue,
      actions,
      policies,
      timeline,
      retention: [
        { label: "Audit logs", period: "7 years", note: "Append-only trail with role-scoped visibility." },
        { label: "Security events", period: "7 years", note: "Security incidents remain searchable for oversight." },
        { label: "Notifications", period: "12 months", note: "Notification ledger supports audit and delivery review." },
        { label: "Sessions", period: "While active", note: "Session records are retained until revoked or expired." },
      ],
        permissionMatrix: rolePermissionMappings.length
          ? rolePermissionMappings.reduce<GovernanceSnapshot["permissionMatrix"]>((rows, record) => {
              const existing = rows.find((item) => item.role === record.role);
              if (existing) {
                existing.permissions.push(record.permissionKey);
                return rows;
              }

              rows.push({
                role: record.role,
                permissions: [record.permissionKey],
                note:
                  record.role === "CUSTOMER"
                    ? "Own vault, nominee and audit scope."
                    : record.role === "NOMINEE"
                      ? "Release and trigger scope only."
                      : record.role === "VERIFICATION_OFFICER"
                        ? "Assigned case review scope."
                        : record.role === "ADMIN"
                          ? "Operational and security oversight."
                          : "System-level governance and policy control.",
              });
              return rows;
            }, [])
          : [],
        readiness,
      };
  }

  async function buildAdminDashboard(principal: ObservabilityPrincipal): Promise<AdminDashboardSnapshot> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can view the admin dashboard.");
    assertPermission(permissions, "ADMIN_VIEW_TRIGGER_QUEUE", "You are not allowed to view the admin dashboard.");

    const readiness = getReadinessPayload(env);
    const [pendingTriggers, requestedTriggers, releases, auditLogs, securityEvents, notifications] = await Promise.all([
      store.listPendingTriggerRequests(8),
      store.listRequestsForAdmin?.({}) ?? Promise.resolve([]),
      store.listReleasesForAdmin?.() ?? Promise.resolve([]),
      store.listAuditLogs({ userId: null, limit: 25 }),
      store.listSecurityEvents({ userId: null, limit: 25 }),
      store.listNotifications({ userId: principal.user.id, limit: 10 }),
    ]);

    const approvedTriggers = requestedTriggers.filter((item) => item.status === "APPROVED").length;
    const rejectedTriggers = requestedTriggers.filter((item) => item.status === "REJECTED").length;
    const recentReleases = releases.slice(0, 8);
    const resolvedSecurityAlerts = securityEvents.filter((item) => !item.isResolved && item.riskLevel !== "LOW");
    const recentAdminEvents = sortAndTrim(
      [
        ...auditLogs.map((row) => mapAuditRow(row, "all")),
        ...securityEvents.map((row) => mapSecurityEvent(row, "all")),
      ],
      8
    );

    const alerts: string[] = [];
    if (!readiness.databaseConfigured) alerts.push("Database configuration is missing.");
    if (!readiness.storageConfigured) alerts.push("Secure storage is not configured.");
    if (!readiness.notificationsConfigured) alerts.push("Notification delivery is not configured.");
    if (pendingTriggers.length > 0) alerts.push(`${pendingTriggers.length} trigger requests are pending review.`);
    if (resolvedSecurityAlerts.length > 0) alerts.push(`${resolvedSecurityAlerts.length} security events need attention.`);
    if (notifications.some((item) => item.status === "FAILED")) alerts.push("One or more recent notifications failed to deliver.");

    const health: GovernanceHealthItem[] = [
      {
        label: "Database",
        description: "Live read models are sourced from the primary data store.",
        status: readiness.databaseConfigured ? "healthy" : "degraded",
      },
      {
        label: "Storage",
        description: "Encrypted object storage is available for vault and release workflows.",
        status: readiness.storageConfigured ? "healthy" : "degraded",
      },
      {
        label: "Notifications",
        description: "Notification delivery and read markers are wired end to end.",
        status: readiness.notificationsConfigured ? "healthy" : "review",
      },
      {
        label: "RBAC",
        description: `${Object.keys(RBAC_ROLE_PERMISSION_KEYS).length} roles mapped to ${RBAC_PERMISSION_CATALOG.length} permissions.`,
        status: permissions.length ? "healthy" : "review",
      },
    ];

    return {
      summary: {
        pendingTriggers: pendingTriggers.length,
        approvedTriggers,
        rejectedTriggers,
        recentReleases: recentReleases.length,
        securityAlerts: resolvedSecurityAlerts.length,
        activeSessions: await store.countSessions(null, true),
        unreadNotifications: notifications.filter((item) => !item.readAt).length,
      },
      health,
      alerts,
      pendingTriggers,
      recentReleases,
      securityAlerts: resolvedSecurityAlerts.map((item) => mapSecurityEvent(item, "all")),
      recentAdminEvents,
      readiness,
    };
  }

  async function buildAdminReports(principal: ObservabilityPrincipal): Promise<AdminReportsSnapshot> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can view reports.");
    assertPermission(permissions, "ADMIN_MANAGE_USERS_LIMITED", "You are not allowed to view operational reports.");

    const [triggerRequests, releases, auditLogs] = await Promise.all([
      store.listRequestsForAdmin?.({}) ?? Promise.resolve([]),
      store.listReleasesForAdmin?.() ?? Promise.resolve([]),
      store.listAuditLogs({ userId: null, limit: 100 }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      triggerReport: {
        title: "Trigger report",
        description: "Live trigger queue records filtered from the request ledger.",
        availableFormats: ["PDF", "CSV", "XLSX"],
        rows: triggerRequests,
      },
      releaseReport: {
        title: "Release report",
        description: "Controlled release ledger filtered from live release records.",
        availableFormats: ["PDF", "CSV", "XLSX"],
        rows: releases,
      },
      auditReport: {
        title: "Audit report",
        description: "Append-only audit records ready for export or review.",
        availableFormats: ["PDF", "CSV", "XLSX"],
        rows: auditLogs.map((row) => mapAuditRow(row, "all")),
      },
    };
  }

  async function buildAdminSettings(principal: ObservabilityPrincipal): Promise<AdminSettingsSnapshot> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can view settings.");
    assertAnyPermission(
      permissions,
      ["ADMIN_MANAGE_USERS_LIMITED", "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS"],
      "You are not allowed to view system settings."
    );

    const readiness = getReadinessPayload(env);
    const [auditLogs, rolePermissions, settings, admins, verificationOfficers] = await Promise.all([
      store.listAuditLogs({ userId: null, limit: 25 }),
      store.listRolePermissions(),
      store.listPlatformSettings(),
      store.listAdminUsers(),
      store.listVerificationOfficers(),
    ]);

      const permissionMatrix = rolePermissions.length
        ? rolePermissions.reduce<GovernanceSnapshot["permissionMatrix"]>((rows, record) => {
            const existing = rows.find((item) => item.role === record.role);
            if (existing) {
              existing.permissions.push(record.permissionKey);
              return rows;
            }

            rows.push({
              role: record.role,
              permissions: [record.permissionKey],
              note:
                record.role === "CUSTOMER"
                  ? "Own vault, nominee and audit scope."
                  : record.role === "NOMINEE"
                    ? "Release and trigger scope only."
                    : record.role === "VERIFICATION_OFFICER"
                      ? "Assigned case review scope."
                      : record.role === "ADMIN"
                        ? "Operational and security oversight."
                        : "System-level governance and policy control.",
            });
            return rows;
          }, [])
        : [];

      return {
        groups: buildAdminSettingGroups(readiness, settings),
        admins,
        verificationOfficers,
        recentChanges: sortAndTrim(auditLogs.map((row) => mapAuditRow(row, "all")), 8),
        permissionMatrix,
        readiness,
      };
  }

  async function updateAdminSettings(
    principal: ObservabilityPrincipal,
    updates: Array<{ key: string; value: string }>,
    context?: AuthRequestContext
  ) {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can update settings.");
    assertAnyPermission(
      permissions,
      ["ADMIN_MANAGE_USERS_LIMITED", "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS"],
      "You are not allowed to update system settings."
    );

    const catalogByKey = new Map(ADMIN_SETTING_CATALOG.map((item) => [item.key, item]));
    const changed: Array<{ key: string; value: string }> = [];

    for (const update of updates) {
      const catalog = catalogByKey.get(update.key);
      if (!catalog) {
        throw new HttpError(400, "VALIDATION_ERROR", `Unknown setting key: ${update.key}.`);
      }

      if (!canEditSetting(permissions, catalog)) {
        throw new HttpError(403, "FORBIDDEN", `You are not allowed to edit ${catalog.key}.`);
      }

      await store.upsertPlatformSetting({
        settingKey: catalog.key,
        groupName: catalog.groupTitle,
        label: catalog.label,
        description: catalog.description,
        value: { value: update.value },
        editableBy: catalog.editableBy === "admin" ? "ADMIN" : "SUPER_ADMIN",
        sensitive: catalog.sensitive,
        source: "admin-console",
        updatedBy: principal.user.id,
      });

      changed.push(update);
    }

    await store.insertAuditLog({
      userId: principal.user.id,
      role: principal.user.role,
      action: "PLATFORM_SETTINGS_UPDATED",
      moduleName: "observability",
      entityType: "platform_settings",
      entityId: null,
      oldValue: null,
      newValue: { changes: changed },
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
    });

    await store.insertSecurityEvent({
      userId: principal.user.id,
      eventType: "PLATFORM_SETTINGS_UPDATED",
      eventDescription: `Updated ${changed.length} platform setting${changed.length === 1 ? "" : "s"}.`,
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
      riskLevel: "MEDIUM",
    });

    return { updatedCount: changed.length };
  }

  async function listAdminAccounts(principal: ObservabilityPrincipal) {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can view admin accounts.");
    assertAnyPermission(
      permissions,
      ["ADMIN_MANAGE_USERS_LIMITED", "SUPER_ADMIN_MANAGE_ADMINS"],
      "You are not allowed to view admin accounts."
    );

    return store.listAdminUsers();
  }

  async function createPrivilegedAccount(
    principal: ObservabilityPrincipal,
    input: {
      fullName: string;
      email: string;
      mobile: string | null;
      role: string;
    },
    context: AuthRequestContext | undefined,
    allowedRoles: Array<PrivilegedCreateResponse["role"]>
  ): Promise<PrivilegedCreateResponse> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["SUPER_ADMIN"], "Only super admins can manage privileged accounts.");
    assertPermission(permissions, "SUPER_ADMIN_MANAGE_ADMINS", "You are not allowed to create privileged accounts.");

    const role = normalizePrivilegedCreateRole(input.role);
    if (!role || !allowedRoles.includes(role)) {
      throw new HttpError(400, "VALIDATION_ERROR", `role must be one of: ${allowedRoles.join(", ")}.`);
    }

    const email = input.email.trim().toLowerCase();
    const existing = await store.findUserByEmail(email);
    if (existing) {
      throw new HttpError(409, "CONFLICT", "An account already exists for this email address.");
    }

    const temporaryPassword = randomToken(16);
    const passwordHash = await hashPassword(temporaryPassword);
    const user = await store.createAdminUser({
      fullName: input.fullName.trim(),
      email,
      mobile: input.mobile,
      passwordHash,
      role,
      status: "ACTIVE",
      isEmailVerified: false,
      isMobileVerified: Boolean(input.mobile),
      mfaEnabled: true,
      mustResetPassword: true,
    });

    if (!user) {
      throw new HttpError(500, "PRIVILEGED_ACCOUNT_CREATE_FAILED", "Privileged account could not be created.");
    }

    const verificationToken = randomToken(32);
    await store.createAuthToken({
      userId: user.id,
      tokenHash: sha256Hex(verificationToken),
      purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      metadata: { email: user.email, privilegedAccount: true, role: user.role },
    });

    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.fullName);
    } catch (error) {
      logger.warn("Verification email delivery failed for privileged account", {
        userId: user.id,
        email: user.email,
        role: user.role,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await store.insertAuditLog({
      userId: principal.user.id,
      role: principal.user.role,
      action: "PRIVILEGED_ACCOUNT_CREATED",
      moduleName: "observability",
      entityType: "user",
      entityId: user.id,
      oldValue: null,
      newValue: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        isEmailVerified: user.isEmailVerified,
        mustResetPassword: user.mustResetPassword,
      },
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
    });

    await store.insertSecurityEvent({
      userId: principal.user.id,
      eventType: "PRIVILEGED_ACCOUNT_CREATED",
      eventDescription: `Privileged account created for ${user.email}.`,
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
      riskLevel: "MEDIUM",
    });

    return { userId: user.id, email: user.email, temporaryPassword, role };
  }

  async function createAdminAccount(
    principal: ObservabilityPrincipal,
    input: {
      fullName: string;
      email: string;
      mobile: string | null;
      role: string;
    },
    context?: AuthRequestContext
  ) {
    if (!normalizeAdminRole(input.role)) {
      throw new HttpError(400, "VALIDATION_ERROR", "role must be ADMIN or SUPER_ADMIN.");
    }

    return createPrivilegedAccount(principal, input, context, ["ADMIN", "SUPER_ADMIN"]);
  }

  async function createVerificationOfficerAccount(
    principal: ObservabilityPrincipal,
    input: {
      fullName: string;
      email: string;
      mobile: string | null;
      role: string;
    },
    context?: AuthRequestContext
  ) {
    const role = normalizePrivilegedCreateRole(input.role);
    if (role !== "VERIFICATION_OFFICER") {
      throw new HttpError(400, "VALIDATION_ERROR", "role must be VERIFICATION_OFFICER.");
    }

    return createPrivilegedAccount(principal, input, context, ["VERIFICATION_OFFICER"]);
  }

  async function updateVerificationOfficerAccount(
    principal: ObservabilityPrincipal,
    officerId: string,
    input: {
      fullName?: string;
      mobile?: string | null;
      status?: UserStatus;
      isEmailVerified?: boolean;
      isMobileVerified?: boolean;
      mfaEnabled?: boolean;
      mustResetPassword?: boolean;
    },
    context?: AuthRequestContext
  ): Promise<PrivilegedAccountActionResponse> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["SUPER_ADMIN"], "Only super admins can manage verification officers.");
    assertPermission(permissions, "SUPER_ADMIN_MANAGE_ADMINS", "You are not allowed to update verification officers.");

    const existing = await store.findUserById(officerId);
    if (!existing || existing.role !== "VERIFICATION_OFFICER") {
      throw new HttpError(404, "USER_NOT_FOUND", "Verification officer not found.");
    }

    const updated = await store.updateUser(officerId, {
      fullName: input.fullName,
      mobile: input.mobile,
      status: input.status,
      isEmailVerified: input.isEmailVerified,
      isMobileVerified: input.isMobileVerified,
      mfaEnabled: input.mfaEnabled,
      mustResetPassword: input.mustResetPassword,
    });

    if (!updated) {
      throw new HttpError(500, "OFFICER_UPDATE_FAILED", "Verification officer could not be updated.");
    }

    await store.insertAuditLog({
      userId: principal.user.id,
      role: principal.user.role,
      action: "VERIFICATION_OFFICER_UPDATED",
      moduleName: "observability",
      entityType: "user",
      entityId: officerId,
      oldValue: {
        fullName: existing.fullName,
        status: existing.status,
        isEmailVerified: existing.isEmailVerified,
        mustResetPassword: existing.mustResetPassword,
      },
      newValue: {
        fullName: updated.fullName,
        status: updated.status,
        isEmailVerified: updated.isEmailVerified,
        mustResetPassword: updated.mustResetPassword,
      },
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
    });

    await store.insertSecurityEvent({
      userId: principal.user.id,
      eventType: "VERIFICATION_OFFICER_UPDATED",
      eventDescription: `Verification officer updated for ${existing.email}.`,
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
      riskLevel: "MEDIUM",
    });

    return { userId: officerId, email: existing.email };
  }

  async function resendVerificationEmail(
    principal: ObservabilityPrincipal,
    officerId: string,
    context?: AuthRequestContext
  ): Promise<PrivilegedAccountActionResponse> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["SUPER_ADMIN"], "Only super admins can resend verification emails.");
    assertPermission(permissions, "SUPER_ADMIN_MANAGE_ADMINS", "You are not allowed to resend verification emails.");

    const officer = await store.findUserById(officerId);
    if (!officer || officer.role !== "VERIFICATION_OFFICER") {
      throw new HttpError(404, "USER_NOT_FOUND", "Verification officer not found.");
    }

    const verificationToken = randomToken(32);
    await store.createAuthToken({
      userId: officer.id,
      tokenHash: sha256Hex(verificationToken),
      purpose: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      metadata: { email: officer.email, privilegedAccount: true, role: officer.role, resent: true },
    });

    await emailService.sendVerificationEmail(officer.email, verificationToken, officer.fullName);

    await store.insertAuditLog({
      userId: principal.user.id,
      role: principal.user.role,
      action: "VERIFICATION_EMAIL_RESENT",
      moduleName: "observability",
      entityType: "user",
      entityId: officer.id,
      oldValue: null,
      newValue: { email: officer.email, role: officer.role },
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
    });

    await store.insertSecurityEvent({
      userId: principal.user.id,
      eventType: "VERIFICATION_EMAIL_RESENT",
      eventDescription: `Verification email resent to ${officer.email}.`,
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
      riskLevel: "LOW",
    });

    return { userId: officer.id, email: officer.email };
  }

  async function reissueVerificationOfficerCredentials(
    principal: ObservabilityPrincipal,
    officerId: string,
    context?: AuthRequestContext
  ): Promise<PrivilegedCreateResponse> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["SUPER_ADMIN"], "Only super admins can reissue officer credentials.");
    assertPermission(permissions, "SUPER_ADMIN_MANAGE_ADMINS", "You are not allowed to reissue officer credentials.");

    const existing = await store.findUserById(officerId);
    if (!existing || existing.role !== "VERIFICATION_OFFICER") {
      throw new HttpError(404, "USER_NOT_FOUND", "Verification officer not found.");
    }

    const temporaryPassword = randomToken(16);
    const passwordHash = await hashPassword(temporaryPassword);
    const updated = await store.updateUser(officerId, {
      passwordHash,
      mustResetPassword: true,
      status: "ACTIVE",
      isEmailVerified: true,
      mfaEnabled: true,
      isMobileVerified: existing.isMobileVerified,
    });

    if (!updated) {
      throw new HttpError(500, "OFFICER_REISSUE_FAILED", "Verification officer credentials could not be reissued.");
    }

    await store.insertAuditLog({
      userId: principal.user.id,
      role: principal.user.role,
      action: "VERIFICATION_OFFICER_CREDENTIALS_REISSUED",
      moduleName: "observability",
      entityType: "user",
      entityId: officerId,
      oldValue: {
        mustResetPassword: existing.mustResetPassword,
      },
      newValue: {
        mustResetPassword: true,
      },
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
    });

    await store.insertSecurityEvent({
      userId: principal.user.id,
      eventType: "VERIFICATION_OFFICER_CREDENTIALS_REISSUED",
      eventDescription: `Credentials reissued for ${existing.email}.`,
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
      riskLevel: "MEDIUM",
    });

    return { userId: officerId, email: existing.email, temporaryPassword, role: "VERIFICATION_OFFICER" };
  }

  async function updateAdminAccount(
    principal: ObservabilityPrincipal,
    adminId: string,
    input: {
      fullName?: string;
      mobile?: string | null;
      role?: string;
      status?: UserStatus;
      mfaEnabled?: boolean;
      isEmailVerified?: boolean;
      isMobileVerified?: boolean;
    },
    context?: AuthRequestContext
  ) {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can manage admin accounts.");
    assertAnyPermission(
      permissions,
      ["ADMIN_MANAGE_USERS_LIMITED", "SUPER_ADMIN_MANAGE_ADMINS"],
      "You are not allowed to update admin accounts."
    );

    const existing = await store.findUserById(adminId);
    if (!existing || (existing.role !== "ADMIN" && existing.role !== "SUPER_ADMIN")) {
      throw new HttpError(404, "USER_NOT_FOUND", "Admin account not found.");
    }

    const nextRole = input.role ? normalizeAdminRole(input.role) : existing.role;
    if (input.role && !nextRole) {
      throw new HttpError(400, "VALIDATION_ERROR", "role must be ADMIN or SUPER_ADMIN.");
    }

    const updated = await store.updateAdminUser(adminId, {
      fullName: input.fullName,
      mobile: input.mobile,
      role: nextRole ?? undefined,
      status: input.status,
      mfaEnabled: input.mfaEnabled,
      isEmailVerified: input.isEmailVerified,
      isMobileVerified: input.isMobileVerified,
    });

    if (!updated) {
      throw new HttpError(500, "ADMIN_UPDATE_FAILED", "Admin account could not be updated.");
    }

    await store.insertAuditLog({
      userId: principal.user.id,
      role: principal.user.role,
      action: "ADMIN_ACCOUNT_UPDATED",
      moduleName: "observability",
      entityType: "user",
      entityId: adminId,
      oldValue: {
        fullName: existing.fullName,
        role: existing.role,
        status: existing.status,
        mfaEnabled: existing.mfaEnabled,
      },
      newValue: {
        fullName: input.fullName ?? existing.fullName,
        role: nextRole ?? existing.role,
        status: input.status ?? existing.status,
        mfaEnabled: input.mfaEnabled ?? existing.mfaEnabled,
      },
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
    });

    await store.insertSecurityEvent({
      userId: principal.user.id,
      eventType: "ADMIN_ACCOUNT_UPDATED",
      eventDescription: `Admin account updated for ${existing.email}.`,
      ipAddress: context?.ipAddress ?? null,
      deviceInfo: context?.deviceInfo ?? null,
      riskLevel: "MEDIUM",
    });

    return { userId: adminId, email: existing.email };
  }

  async function buildBackupSnapshot(principal: ObservabilityPrincipal): Promise<BackupSnapshot> {
    const permissions = await getPermissions(principal.user.id);
    assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can view backup posture.");
    assertPermission(permissions, "ADMIN_VIEW_AUDIT_LOG", "You are not allowed to view backup posture.");

    const readiness = getReadinessPayload(env);
    const auditLogs = await store.listAuditLogs({ userId: null, limit: 50 });

    const auditTrail = sortAndTrim(
      auditLogs
        .map((row) => mapAuditRow(row, "all"))
        .filter((event) => /backup|export|audit|release/i.test(`${event.moduleName ?? ""} ${event.title} ${event.summary}`)),
      12
    );

    const reports = [
      {
        id: "audit-export",
        title: "Audit log export",
        description: "Append-only audit records prepared for oversight review.",
        scope: "Audit, workflow and access events",
        retention: "7 years",
        format: "PDF" as const,
        generatedBy: "Compliance",
        generatedAt: auditTrail[0]?.occurredAt ?? new Date().toISOString(),
        domain: "compliance" as const,
      },
      {
        id: "security-export",
        title: "Security event export",
        description: "Security events and incident traces with role-aware visibility.",
        scope: "Login, device trust and anomaly events",
        retention: "7 years",
        format: "CSV" as const,
        generatedBy: "Security center",
        generatedAt: auditTrail[0]?.occurredAt ?? new Date().toISOString(),
        domain: "security" as const,
      },
      {
        id: "notification-export",
        title: "Notification ledger export",
        description: "Notification history for delivery review and read tracking.",
        scope: "In-app and outbound notification activity",
        retention: "12 months",
        format: "JSON" as const,
        generatedBy: "Notifications",
        generatedAt: new Date().toISOString(),
        domain: "notification" as const,
      },
    ];

    return {
      schedule: "Daily 02:00 IST",
      retention: "365 days",
      readiness,
      artifacts: buildBackupArtifacts(reports, readiness),
      auditTrail,
      alerts: buildBackupAlerts(readiness, auditTrail),
    };
  }

  return {
    async listAuditLogs(principal: ObservabilityPrincipal, limit = 25) {
      return buildScopedAuditLogs(principal, limit);
    },
    async exportAuditLogs(principal: ObservabilityPrincipal, params?: { action?: string | null; moduleName?: string | null; fromDate?: string | null; toDate?: string | null }) {
      const permissions = await getPermissions(principal.user.id);
      assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can export audit logs.");
      assertPermission(permissions, "ADMIN_VIEW_AUDIT_LOG", "You are not allowed to export audit logs.");

      const parsedFrom = params?.fromDate ? new Date(params.fromDate) : null;
      const parsedTo = params?.toDate ? new Date(params.toDate) : null;
      const rows = await store.listAuditLogs({
        userId: null,
        limit: 100,
        action: params?.action ?? null,
        moduleName: params?.moduleName ?? null,
        fromDate: parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : null,
        toDate: parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : null,
      });

      return {
        generatedAt: new Date().toISOString(),
        rows: rows.map((row) => mapAuditRow(row, "all")),
      };
    },
    async listSecurityEvents(principal: ObservabilityPrincipal, limit = 25) {
      return buildSecurityEvents(principal, limit);
    },
    async listSecuritySessions(principal: ObservabilityPrincipal, limit = 25) {
      return buildSecuritySessions(principal, limit);
    },
    async listSecurityDevices(principal: ObservabilityPrincipal, limit = 25) {
      return buildSecurityDevices(principal, limit);
    },
    async revokeSecurityDevice(principal: ObservabilityPrincipal, deviceId: string) {
      const permissions = await getPermissions(principal.user.id);
      assertPermission(permissions, "ADMIN_VIEW_SECURITY_EVENTS", "You are not allowed to revoke devices.");

      const scope = isSecurityPermissionScope(permissions) ? null : principal.user.id;
      const sessions = await store.listSessions({
        userId: scope,
        limit: 100,
      });
      const devices = deriveSecurityDevices(sessions);
      const device = devices.find((item) => item.id === deviceId);

      if (!device) {
        throw new HttpError(404, "DEVICE_NOT_FOUND", "Device not found.");
      }

      const revokedSessionCount = await store.revokeSessionsByDeviceSignature({
        userId: device.userId,
        deviceInfo: device.deviceInfo,
        browserInfo: device.browserInfo,
        locationInfo: device.locationInfo,
      });

      if (revokedSessionCount > 0) {
        await store.insertAuditLog({
          userId: principal.user.id,
          role: principal.user.role,
          action: "SECURITY_DEVICE_REVOKED",
          moduleName: "security",
          entityType: "security_device",
          entityId: device.id,
          oldValue: {
            deviceInfo: device.deviceInfo,
            browserInfo: device.browserInfo,
            locationInfo: device.locationInfo,
            activeSessionCount: device.activeSessionCount,
            totalSessionCount: device.totalSessionCount,
          },
          newValue: {
            revokedSessionCount,
          },
          ipAddress: null,
          deviceInfo: null,
        });

        await store.insertSecurityEvent({
          userId: principal.user.id,
          eventType: "SECURITY_DEVICE_REVOKED",
          eventDescription: `${device.fullName}'s ${device.deviceInfo ?? "device"} was revoked from the security center.`,
          ipAddress: null,
          deviceInfo: device.deviceInfo,
          riskLevel: "MEDIUM",
        });
      }

      return {
        deviceId: device.id,
        revokedSessionCount,
      };
    },
    async listNotifications(principal: ObservabilityPrincipal, limit = 25) {
      return buildNotifications(principal, limit);
    },
    async getEventLog(principal: ObservabilityPrincipal, limit = 25) {
      return buildEventLog(principal, limit);
    },
    async markNotificationRead(principal: ObservabilityPrincipal, notificationId: string) {
      const updated = await store.markNotificationRead(principal.user.id, notificationId);
      if (!updated) {
        throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
      }
      return { notificationId };
    },
    async markAllNotificationsRead(principal: ObservabilityPrincipal) {
      const updatedCount = await store.markAllNotificationsRead(principal.user.id);
      return { updatedCount };
    },
    async getGovernanceSnapshot(principal: ObservabilityPrincipal) {
      return buildGovernanceSnapshot(principal);
    },
    async getAdminDashboard(principal: ObservabilityPrincipal) {
      return buildAdminDashboard(principal);
    },
    async getAdminReports(principal: ObservabilityPrincipal) {
      return buildAdminReports(principal);
    },
    async getAdminSettings(principal: ObservabilityPrincipal) {
      return buildAdminSettings(principal);
    },
    async updateAdminSettings(principal: ObservabilityPrincipal, updates: Array<{ key: string; value: string }>, context?: AuthRequestContext) {
      return updateAdminSettings(principal, updates, context);
    },
    async listAdminAccounts(principal: ObservabilityPrincipal) {
      return listAdminAccounts(principal);
    },
    async listVerificationOfficers(principal: ObservabilityPrincipal) {
      const permissions = await getPermissions(principal.user.id);
      assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can view verification officers.");
      assertAnyPermission(
        permissions,
        ["ADMIN_MANAGE_USERS_LIMITED", "SUPER_ADMIN_MANAGE_ADMINS"],
        "You are not allowed to view verification officers."
      );

      return store.listVerificationOfficers();
    },
    async createAdminAccount(
      principal: ObservabilityPrincipal,
      input: { fullName: string; email: string; mobile: string | null; role: string },
      context?: AuthRequestContext
    ) {
      return createAdminAccount(principal, input, context);
    },
    async createVerificationOfficerAccount(
      principal: ObservabilityPrincipal,
      input: { fullName: string; email: string; mobile: string | null; role: string },
      context?: AuthRequestContext
    ) {
      return createVerificationOfficerAccount(principal, input, context);
    },
    async updateVerificationOfficerAccount(
      principal: ObservabilityPrincipal,
      officerId: string,
      input: {
        fullName?: string;
        mobile?: string | null;
        status?: UserStatus;
        isEmailVerified?: boolean;
        isMobileVerified?: boolean;
        mfaEnabled?: boolean;
        mustResetPassword?: boolean;
      },
      context?: AuthRequestContext
    ) {
      return updateVerificationOfficerAccount(principal, officerId, input, context);
    },
    async resendVerificationEmail(
      principal: ObservabilityPrincipal,
      officerId: string,
      context?: AuthRequestContext
    ) {
      return resendVerificationEmail(principal, officerId, context);
    },
    async reissueVerificationOfficerCredentials(
      principal: ObservabilityPrincipal,
      officerId: string,
      context?: AuthRequestContext
    ) {
      return reissueVerificationOfficerCredentials(principal, officerId, context);
    },
    async updateAdminAccount(
      principal: ObservabilityPrincipal,
      adminId: string,
      input: {
        fullName?: string;
        mobile?: string | null;
        role?: string;
        status?: UserStatus;
        mfaEnabled?: boolean;
        isEmailVerified?: boolean;
        isMobileVerified?: boolean;
      },
      context?: AuthRequestContext
    ) {
      return updateAdminAccount(principal, adminId, input, context);
    },
    async getBackupSnapshot(principal: ObservabilityPrincipal) {
      return buildBackupSnapshot(principal);
    },
    async getComplianceReports(principal: ObservabilityPrincipal) {
      const permissions = await getPermissions(principal.user.id);
      assertRole(principal.user.role, ["ADMIN", "SUPER_ADMIN"], "Only administrators can view compliance reports.");

      if (!isAdminPermissionScope(permissions) && !isGovernanceScope(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "You are not allowed to view compliance reports.");
      }

      return makeComplianceReports();
    },
    async getDashboardSnapshot(principal: ObservabilityPrincipal) {
      const snapshot = await buildGovernanceSnapshot(principal);
      return {
        dashboard: snapshot,
        complianceReports: makeComplianceReports(),
      };
    },
  };
}

export type ObservabilityService = ReturnType<typeof createObservabilityService>;
