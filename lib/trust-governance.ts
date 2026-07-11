export type TrustRole = "customer" | "nominee" | "admin" | "super_admin";

export type TrustDomain = "audit" | "security" | "notification" | "session" | "compliance";

export type TrustSeverity = "low" | "medium" | "high" | "critical";

export type TrustOutcome = "success" | "warning" | "blocked" | "info";

export type TrustEventType =
  | "login-success"
  | "login-failed"
  | "password-changed"
  | "mfa-changed"
  | "new-device"
  | "session-started"
  | "session-ended"
  | "permission-changed"
  | "record-uploaded"
  | "record-viewed"
  | "record-downloaded"
  | "nominee-invited"
  | "nominee-accepted"
  | "trigger-created"
  | "trigger-reviewed"
  | "proof-uploaded"
  | "proof-verified"
  | "release-created"
  | "release-accessed"
  | "notification-delivered"
  | "export-generated"
  | "suspicious-activity";

export type TrustEvent = {
  id: string;
  domain: TrustDomain;
  type: TrustEventType;
  title: string;
  summary: string;
  actor: string;
  actorRole: TrustRole | "system";
  subject: string;
  outcome: TrustOutcome;
  severity: TrustSeverity;
  audiences: TrustRole[];
  occurredAt: string;
  device: string;
  location: string;
  details: string;
};

export type SecurityEvent = {
  id: string;
  title: string;
  summary: string;
  category: "login" | "device" | "mfa" | "session" | "permission" | "release" | "export";
  severity: TrustSeverity;
  status: "open" | "monitoring" | "contained" | "resolved";
  audiences: TrustRole[];
  detectedAt: string;
  resolvedAt?: string | null;
  actor: string;
  location: string;
  device: string;
  response: string;
};

export type TrustNotification = {
  id: string;
  title: string;
  message: string;
  category: "security" | "audit" | "workflow" | "release" | "compliance";
  priority: "low" | "medium" | "high";
  audiences: TrustRole[];
  delivery: "in-app" | "email" | "sms";
  createdAt: string;
  readAt?: string | null;
  source: string;
  actionLabel?: string;
};

export type DeviceSession = {
  id: string;
  userName: string;
  role: TrustRole;
  deviceName: string;
  platform: string;
  browser: string;
  location: string;
  ipAddress: string;
  startedAt: string;
  lastActiveAt: string;
  status: "active" | "idle" | "ended" | "revoked";
  trustLevel: "verified" | "review" | "blocked";
  current: boolean;
  audiences: TrustRole[];
};

export type ComplianceReport = {
  id: string;
  title: string;
  description: string;
  format: "PDF" | "CSV";
  scope: string;
  generatedFor: TrustRole;
  generatedBy: string;
  generatedAt: string;
  retention: string;
  status: "ready" | "queued" | "archived";
};

const roleOrder: TrustRole[] = ["customer", "nominee", "admin", "super_admin"];

export const trustRoleLabels: Record<TrustRole, string> = {
  customer: "Customer",
  nominee: "Nominee",
  admin: "Admin",
  super_admin: "Super admin",
};

export const trustDomainLabels: Record<TrustDomain, string> = {
  audit: "Audit",
  security: "Security",
  notification: "Notification",
  session: "Session",
  compliance: "Compliance",
};

export const trustSeverityLabels: Record<TrustSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const defaultTrustEvents: TrustEvent[] = [
  {
    id: "event-export-001",
    domain: "compliance",
    type: "export-generated",
    title: "Compliance export generated",
    summary: "Super admin exported the 30 day audit pack for board review.",
    actor: "Platform Compliance",
    actorRole: "super_admin",
    subject: "Monthly compliance pack",
    outcome: "success",
    severity: "low",
    audiences: ["admin", "super_admin"],
    occurredAt: "2026-06-09T04:45:00.000Z",
    device: "Operations console",
    location: "New Delhi, India",
    details: "Export contained redacted metadata, access summaries, incident counts and retention stamps only.",
  },
  {
    id: "event-notification-001",
    domain: "notification",
    type: "notification-delivered",
    title: "Release notification delivered",
    summary: "Nominee received the controlled release notice for the will document.",
    actor: "INHERIX Platform",
    actorRole: "system",
    subject: "Nominee release notice",
    outcome: "success",
    severity: "low",
    audiences: ["nominee", "admin", "super_admin"],
    occurredAt: "2026-06-08T18:22:00.000Z",
    device: "Notification service",
    location: "India Standard Time",
    details: "Notification delivery was confirmed through in-app and email channels with no document content included.",
  },
  {
    id: "event-release-001",
    domain: "audit",
    type: "release-accessed",
    title: "Released document downloaded",
    summary: "A nominee accessed the released document after authorization checks.",
    actor: "Amit Tyagi",
    actorRole: "nominee",
    subject: "Will Document",
    outcome: "success",
    severity: "medium",
    audiences: ["nominee", "admin", "super_admin"],
    occurredAt: "2026-06-08T18:17:00.000Z",
    device: "Chrome on Windows",
    location: "Mumbai, India",
    details: "Access token was issued after release policy checks. No raw document data was recorded in the audit trail.",
  },
  {
    id: "event-release-002",
    domain: "audit",
    type: "release-created",
    title: "Controlled release configured",
    summary: "Admin configured view and download limits for an approved trigger case.",
    actor: "Rahul Sharma",
    actorRole: "admin",
    subject: "Emergency trigger review",
    outcome: "success",
    severity: "medium",
    audiences: ["admin", "super_admin"],
    occurredAt: "2026-06-08T18:05:00.000Z",
    device: "Admin console",
    location: "Delhi, India",
    details: "Release scope matched the owner-defined access rule and remained append-only in the audit ledger.",
  },
  {
    id: "event-proof-verify-001",
    domain: "security",
    type: "proof-verified",
    title: "Proof package verified",
    summary: "The uploaded proof package was reviewed and approved by admin staff.",
    actor: "Rahul Sharma",
    actorRole: "admin",
    subject: "Emergency claim proof",
    outcome: "success",
    severity: "medium",
    audiences: ["admin", "super_admin"],
    occurredAt: "2026-06-08T17:54:00.000Z",
    device: "Admin console",
    location: "Delhi, India",
    details: "Verification covered file integrity, identity match and request consistency only.",
  },
  {
    id: "event-proof-upload-001",
    domain: "audit",
    type: "proof-uploaded",
    title: "Proof document uploaded",
    summary: "Nominee submitted the supporting proof bundle for emergency review.",
    actor: "Amit Tyagi",
    actorRole: "nominee",
    subject: "Emergency request proof",
    outcome: "success",
    severity: "low",
    audiences: ["nominee", "admin", "super_admin"],
    occurredAt: "2026-06-08T17:40:00.000Z",
    device: "Chrome on Windows",
    location: "Mumbai, India",
    details: "Uploaded proof metadata captured file name, type and size only. No raw file contents were logged.",
  },
  {
    id: "event-trigger-001",
    domain: "audit",
    type: "trigger-reviewed",
    title: "Trigger request reviewed",
    summary: "Admin marked the emergency request as approved after proof validation.",
    actor: "Rahul Sharma",
    actorRole: "admin",
    subject: "Emergency trigger request",
    outcome: "success",
    severity: "medium",
    audiences: ["admin", "super_admin"],
    occurredAt: "2026-06-08T17:35:00.000Z",
    device: "Admin console",
    location: "Delhi, India",
    details: "Review decision, note and escalation path were recorded in the workflow log.",
  },
  {
    id: "event-trigger-002",
    domain: "audit",
    type: "trigger-created",
    title: "Emergency trigger created",
    summary: "Nominee initiated a new continuity trigger for manual review.",
    actor: "Amit Tyagi",
    actorRole: "nominee",
    subject: "Emergency trigger request",
    outcome: "success",
    severity: "low",
    audiences: ["nominee", "admin", "super_admin"],
    occurredAt: "2026-06-08T16:58:00.000Z",
    device: "Chrome on Windows",
    location: "Mumbai, India",
    details: "Request metadata captured the workflow state without storing sensitive message contents.",
  },
  {
    id: "event-permission-001",
    domain: "audit",
    type: "permission-changed",
    title: "Access rule tightened",
    summary: "Customer restricted download access for a high-sensitivity document.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "Insurance Policy",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-08T10:15:00.000Z",
    device: "Safari on MacBook",
    location: "Delhi, India",
    details: "Permission change affected only the controlled-release policy. The audit trail remains append-only.",
  },
  {
    id: "event-download-001",
    domain: "audit",
    type: "record-downloaded",
    title: "Document download authorised",
    summary: "Customer downloaded a verified vault record after authorization checks.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "Will Document",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-07T19:18:00.000Z",
    device: "Chrome on Windows",
    location: "Delhi, India",
    details: "Download ticket was generated with no embedded raw document payload.",
  },
  {
    id: "event-view-001",
    domain: "audit",
    type: "record-viewed",
    title: "Record opened in protected vault",
    summary: "Customer viewed a continuity record from the secure detail page.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "Insurance Policy",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-07T18:55:00.000Z",
    device: "Chrome on Windows",
    location: "Delhi, India",
    details: "View events capture access intent and outcome only, not the underlying file contents.",
  },
  {
    id: "event-upload-001",
    domain: "audit",
    type: "record-uploaded",
    title: "Record uploaded to vault",
    summary: "Customer uploaded a new continuity record with encrypted metadata.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "Business Continuity Note",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-06T11:30:00.000Z",
    device: "Chrome on Windows",
    location: "Delhi, India",
    details: "The record payload was stored as encrypted metadata with a checksum and file reference only.",
  },
  {
    id: "event-session-001",
    domain: "session",
    type: "session-ended",
    title: "Suspicious session revoked",
    summary: "An unfamiliar browser session was revoked after a failed login burst.",
    actor: "Security automation",
    actorRole: "system",
    subject: "Unknown browser session",
    outcome: "blocked",
    severity: "high",
    audiences: ["admin", "super_admin"],
    occurredAt: "2026-06-05T22:18:00.000Z",
    device: "Chrome on Linux",
    location: "Singapore",
    details: "Session was terminated after risk scoring crossed the threshold. No secret material was exposed.",
  },
  {
    id: "event-device-001",
    domain: "security",
    type: "new-device",
    title: "New device detected",
    summary: "The platform detected a new trusted laptop for the owner account.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "MacBook Pro",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-05T09:12:00.000Z",
    device: "Safari on MacBook",
    location: "Delhi, India",
    details: "Device enrolment recorded fingerprint, browser family and trust flag only.",
  },
  {
    id: "event-mfa-001",
    domain: "security",
    type: "mfa-changed",
    title: "MFA configuration updated",
    summary: "The owner refreshed multi-factor protection on the account.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "Account MFA settings",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-04T08:40:00.000Z",
    device: "Settings console",
    location: "Delhi, India",
    details: "Updated factors were logged without storing the seed, code or backup token data.",
  },
  {
    id: "event-password-001",
    domain: "security",
    type: "password-changed",
    title: "Password rotated",
    summary: "The owner updated the account password after a security review.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "Primary login credentials",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-03T14:22:00.000Z",
    device: "Chrome on Windows",
    location: "Delhi, India",
    details: "No raw password values, reset links or tokens are ever persisted in the audit record.",
  },
  {
    id: "event-login-failed-001",
    domain: "security",
    type: "login-failed",
    title: "Failed login detected",
    summary: "A suspicious login attempt was blocked before authentication completed.",
    actor: "Unknown user",
    actorRole: "system",
    subject: "Primary account sign-in",
    outcome: "blocked",
    severity: "high",
    audiences: ["admin", "super_admin"],
    occurredAt: "2026-06-02T23:11:00.000Z",
    device: "Chrome on Windows",
    location: "Bengaluru, India",
    details: "Repeated failures were rate-limited and a threat flag was raised for operational review.",
  },
  {
    id: "event-login-success-001",
    domain: "security",
    type: "login-success",
    title: "Successful login",
    summary: "The owner signed in from a verified desktop session.",
    actor: "Rahul Sharma",
    actorRole: "customer",
    subject: "Primary account sign-in",
    outcome: "success",
    severity: "low",
    audiences: ["customer", "admin", "super_admin"],
    occurredAt: "2026-06-02T08:05:00.000Z",
    device: "Chrome on Windows",
    location: "Delhi, India",
    details: "Sign-in metadata included browser, device fingerprint and time only.",
  },
];

export const defaultSecurityEvents: SecurityEvent[] = [
  {
    id: "security-001",
    title: "Unfamiliar login burst",
    summary: "Multiple failed logins came from an unfamiliar IP range before the session was blocked.",
    category: "login",
    severity: "high",
    status: "contained",
    audiences: ["admin", "super_admin"],
    detectedAt: "2026-06-02T23:11:00.000Z",
    resolvedAt: "2026-06-02T23:18:00.000Z",
    actor: "Unknown user",
    location: "Bengaluru, India",
    device: "Chrome on Windows",
    response: "Rate limit applied, session revoked and the account flagged for extra review.",
  },
  {
    id: "security-002",
    title: "New device enrolment",
    summary: "A new trusted desktop was added after a verified sign-in challenge.",
    category: "device",
    severity: "low",
    status: "resolved",
    audiences: ["customer", "admin", "super_admin"],
    detectedAt: "2026-06-05T09:12:00.000Z",
    resolvedAt: "2026-06-05T09:18:00.000Z",
    actor: "Rahul Sharma",
    location: "Delhi, India",
    device: "Safari on MacBook",
    response: "Device fingerprint stored and matched against the owner profile.",
  },
  {
    id: "security-003",
    title: "MFA settings refreshed",
    summary: "The owner updated MFA factors as part of a security maintenance check.",
    category: "mfa",
    severity: "low",
    status: "resolved",
    audiences: ["customer", "admin", "super_admin"],
    detectedAt: "2026-06-04T08:40:00.000Z",
    resolvedAt: "2026-06-04T08:46:00.000Z",
    actor: "Rahul Sharma",
    location: "Delhi, India",
    device: "Settings console",
    response: "No recovery codes or factor secrets were written to logs.",
  },
  {
    id: "security-004",
    title: "Release policy check",
    summary: "A release was validated against access rules before the nominee could open it.",
    category: "release",
    severity: "medium",
    status: "monitoring",
    audiences: ["admin", "super_admin"],
    detectedAt: "2026-06-08T18:05:00.000Z",
    resolvedAt: null,
    actor: "Rahul Sharma",
    location: "Delhi, India",
    device: "Admin console",
    response: "Workflow stayed locked until the rule set, trigger case and proof package aligned.",
  },
  {
    id: "security-005",
    title: "Export review trail",
    summary: "A compliance export was created for audit oversight and stored for retention.",
    category: "export",
    severity: "low",
    status: "resolved",
    audiences: ["admin", "super_admin"],
    detectedAt: "2026-06-09T04:45:00.000Z",
    resolvedAt: "2026-06-09T04:47:00.000Z",
    actor: "Platform Compliance",
    location: "New Delhi, India",
    device: "Operations console",
    response: "Export included only redacted metadata, summary counts and signed timestamps.",
  },
];

export const defaultTrustNotifications: TrustNotification[] = [
  {
    id: "notification-001",
    title: "Document release ready",
    message: "The approved release for the Will Document is now visible to the nominee.",
    category: "release",
    priority: "high",
    audiences: ["nominee", "admin", "super_admin"],
    delivery: "in-app",
    createdAt: "2026-06-08T18:22:00.000Z",
    readAt: null,
    source: "Release center",
    actionLabel: "Open release",
  },
  {
    id: "notification-002",
    title: "Trigger approved",
    message: "The emergency trigger moved into release preparation after proof review.",
    category: "workflow",
    priority: "high",
    audiences: ["admin", "super_admin"],
    delivery: "in-app",
    createdAt: "2026-06-08T17:36:00.000Z",
    readAt: "2026-06-08T17:58:00.000Z",
    source: "Workflow queue",
  },
  {
    id: "notification-003",
    title: "Security alert contained",
    message: "A suspicious login burst was blocked and the session was revoked.",
    category: "security",
    priority: "high",
    audiences: ["admin", "super_admin"],
    delivery: "email",
    createdAt: "2026-06-02T23:18:00.000Z",
    readAt: "2026-06-03T07:12:00.000Z",
    source: "Security center",
    actionLabel: "Review incident",
  },
  {
    id: "notification-004",
    title: "Nominee invitation accepted",
    message: "Rahul Sharma accepted the invitation and is now visible in the access map.",
    category: "audit",
    priority: "medium",
    audiences: ["customer", "admin", "super_admin"],
    delivery: "in-app",
    createdAt: "2026-05-12T11:15:00.000Z",
    readAt: "2026-05-12T12:05:00.000Z",
    source: "Family access",
  },
  {
    id: "notification-005",
    title: "Compliance export queued",
    message: "The 30 day compliance export is ready for download and archive.",
    category: "compliance",
    priority: "medium",
    audiences: ["admin", "super_admin"],
    delivery: "email",
    createdAt: "2026-06-09T04:45:00.000Z",
    readAt: null,
    source: "Compliance center",
    actionLabel: "Download export",
  },
  {
    id: "notification-006",
    title: "Session activity update",
    message: "Your desktop session is currently active on a verified device.",
    category: "security",
    priority: "low",
    audiences: ["customer"],
    delivery: "in-app",
    createdAt: "2026-06-09T06:12:00.000Z",
    readAt: null,
    source: "Session monitor",
    actionLabel: "View sessions",
  },
];

export const defaultDeviceSessions: DeviceSession[] = [
  {
    id: "session-001",
    userName: "Rahul Sharma",
    role: "customer",
    deviceName: "Dell XPS 15",
    platform: "Windows 11",
    browser: "Chrome 126",
    location: "Delhi, India",
    ipAddress: "192.168.1.24",
    startedAt: "2026-06-09T06:10:00.000Z",
    lastActiveAt: "2026-06-09T06:40:00.000Z",
    status: "active",
    trustLevel: "verified",
    current: true,
    audiences: ["customer", "admin", "super_admin"],
  },
  {
    id: "session-002",
    userName: "Rahul Sharma",
    role: "customer",
    deviceName: "iPhone 15",
    platform: "iOS 18",
    browser: "Safari 18",
    location: "Mumbai, India",
    ipAddress: "192.168.1.57",
    startedAt: "2026-06-08T21:18:00.000Z",
    lastActiveAt: "2026-06-08T21:50:00.000Z",
    status: "idle",
    trustLevel: "verified",
    current: false,
    audiences: ["customer", "admin", "super_admin"],
  },
  {
    id: "session-003",
    userName: "Amit Tyagi",
    role: "nominee",
    deviceName: "MacBook Pro",
    platform: "macOS 15",
    browser: "Chrome 126",
    location: "Mumbai, India",
    ipAddress: "203.0.113.14",
    startedAt: "2026-06-08T17:35:00.000Z",
    lastActiveAt: "2026-06-08T18:18:00.000Z",
    status: "active",
    trustLevel: "verified",
    current: false,
    audiences: ["nominee", "admin", "super_admin"],
  },
  {
    id: "session-004",
    userName: "Unknown browser",
    role: "admin",
    deviceName: "Linux workstation",
    platform: "Ubuntu 24.04",
    browser: "Chrome 126",
    location: "Singapore",
    ipAddress: "198.51.100.22",
    startedAt: "2026-06-05T22:14:00.000Z",
    lastActiveAt: "2026-06-05T22:18:00.000Z",
    status: "revoked",
    trustLevel: "blocked",
    current: false,
    audiences: ["admin", "super_admin"],
  },
];

export const defaultComplianceReports: ComplianceReport[] = [
  {
    id: "report-001",
    title: "30 day audit pack",
    description: "Redacted activity, access and workflow summary for the current review window.",
    format: "PDF",
    scope: "Audit events, security incidents and workflow decisions",
    generatedFor: "super_admin",
    generatedBy: "Platform Compliance",
    generatedAt: "2026-06-09T04:45:00.000Z",
    retention: "Stored for 365 days",
    status: "ready",
  },
  {
    id: "report-002",
    title: "Incident register export",
    description: "Security incidents and session revocations for operational follow-up.",
    format: "CSV",
    scope: "Security events and response outcomes",
    generatedFor: "admin",
    generatedBy: "Security automation",
    generatedAt: "2026-06-05T22:20:00.000Z",
    retention: "Stored for 90 days",
    status: "ready",
  },
  {
    id: "report-003",
    title: "Release chain record",
    description: "Audit trail for trigger approval, proof verification and controlled release.",
    format: "PDF",
    scope: "Release workflow with nominee-facing notifications",
    generatedFor: "admin",
    generatedBy: "Release center",
    generatedAt: "2026-06-08T18:30:00.000Z",
    retention: "Stored for 180 days",
    status: "ready",
  },
];

export function getTrustRoleLabel(role: TrustRole | "system") {
  if (role === "system") {
    return "System";
  }

  return trustRoleLabels[role];
}

export function getTrustEventLabel(type: TrustEventType) {
  const labels: Record<TrustEventType, string> = {
    "login-success": "Login success",
    "login-failed": "Login failed",
    "password-changed": "Password changed",
    "mfa-changed": "MFA updated",
    "new-device": "New device",
    "session-started": "Session started",
    "session-ended": "Session ended",
    "permission-changed": "Permission changed",
    "record-uploaded": "Record uploaded",
    "record-viewed": "Record viewed",
    "record-downloaded": "Record downloaded",
    "nominee-invited": "Nominee invited",
    "nominee-accepted": "Nominee accepted",
    "trigger-created": "Trigger created",
    "trigger-reviewed": "Trigger reviewed",
    "proof-uploaded": "Proof uploaded",
    "proof-verified": "Proof verified",
    "release-created": "Release created",
    "release-accessed": "Release accessed",
    "notification-delivered": "Notification delivered",
    "export-generated": "Export generated",
    "suspicious-activity": "Suspicious activity",
  };

  return labels[type];
}

export function getTrustOutcomeTone(outcome: TrustOutcome) {
  if (outcome === "success" || outcome === "info") {
    return "success" as const;
  }

  if (outcome === "warning") {
    return "warning" as const;
  }

  return "destructive" as const;
}

export function getTrustSeverityTone(severity: TrustSeverity) {
  if (severity === "low") {
    return "success" as const;
  }

  if (severity === "medium") {
    return "warning" as const;
  }

  return "destructive" as const;
}

export function getNotificationTone(priority: TrustNotification["priority"]) {
  if (priority === "low") {
    return "secondary" as const;
  }

  if (priority === "medium") {
    return "warning" as const;
  }

  return "destructive" as const;
}

export function getSessionTone(session: DeviceSession) {
  if (session.status === "active") {
    return "success" as const;
  }

  if (session.status === "idle") {
    return "warning" as const;
  }

  return "destructive" as const;
}

export function getSecurityStatusTone(status: SecurityEvent["status"]) {
  if (status === "resolved") {
    return "success" as const;
  }

  if (status === "monitoring") {
    return "warning" as const;
  }

  if (status === "contained") {
    return "secondary" as const;
  }

  return "destructive" as const;
}

export function formatTrustDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTrustCompactDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function filterTrustEventsByRole(events: TrustEvent[], role: TrustRole) {
  return events.filter((event) => event.audiences.includes(role));
}

export function filterSecurityEventsByRole(events: SecurityEvent[], role: TrustRole) {
  return events.filter((event) => event.audiences.includes(role));
}

export function filterNotificationsByRole(notifications: TrustNotification[], role: TrustRole) {
  return notifications.filter((notification) => notification.audiences.includes(role));
}

export function filterSessionsByRole(sessions: DeviceSession[], role: TrustRole) {
  return sessions.filter((session) => session.audiences.includes(role));
}

export function filterComplianceReportsByRole(reports: ComplianceReport[], role: TrustRole) {
  const allowed = roleOrder.indexOf(role);

  return reports.filter((report) => roleOrder.indexOf(report.generatedFor) <= allowed);
}

export function getTrustEventDomainLabel(domain: TrustDomain) {
  return trustDomainLabels[domain];
}

