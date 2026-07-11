import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";
import { createObservabilityService } from "../dist/modules/observability/observability.service.js";
import { RBAC_ROLE_PERMISSION_KEYS } from "../dist/modules/rbac/permissions.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: 0,
  API_PREFIX: "/api/v1",
  API_BASE_URL: "http://127.0.0.1:0/api/v1",
  LOG_LEVEL: "silent",
  FRONTEND_ORIGIN: "http://localhost:3000",
  SWAGGER_ENABLED: true,
  TRUST_PROXY: false,
  REQUEST_BODY_LIMIT: "1mb",
  DATABASE_URL: undefined,
  JWT_ACCESS_SECRET: undefined,
  JWT_REFRESH_SECRET: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  S3_BUCKET_NAME: undefined,
  AWS_REGION: undefined,
  AWS_KMS_KEY_ID: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createPrincipal(role = "ADMIN", id = "admin-1", email = "admin@example.com") {
  return {
    user: {
      id,
      email,
      role,
    },
    session: {
      id: "session-1",
    },
    accessToken: "token",
    authenticatedBy: "access",
  };
}

function createSession({
  id,
  createdAt,
  expiresAt,
  revokedAt = null,
  rotatedAt = null,
  isActive = true,
  deviceInfo,
  browserInfo,
  locationInfo,
  ipAddress,
}) {
  return {
    id,
    userId: "admin-1",
    fullName: "Admin User",
    email: "admin@example.com",
    role: "ADMIN",
    ipAddress,
    deviceInfo,
    browserInfo,
    locationInfo,
    isActive,
    createdAt,
    expiresAt,
    revokedAt,
    rotatedAt,
  };
}

function createMemoryObservabilityStore() {
  const base = "2026-07-01T12:00:00.000Z";
  const sessions = [
    createSession({
      id: "sess-1",
      createdAt: "2026-07-01T11:50:00.000Z",
      expiresAt: base,
      deviceInfo: "MacBook Pro",
      browserInfo: "Safari 18",
      locationInfo: "Austin, US",
      ipAddress: "10.0.0.1",
    }),
    createSession({
      id: "sess-2",
      createdAt: "2026-07-01T11:10:00.000Z",
      expiresAt: base,
      deviceInfo: "MacBook Pro",
      browserInfo: "Safari 18",
      locationInfo: "Austin, US",
      ipAddress: "10.0.0.2",
    }),
    createSession({
      id: "sess-3",
      createdAt: "2026-07-01T10:05:00.000Z",
      expiresAt: base,
      deviceInfo: "Windows Desktop",
      browserInfo: "Chrome 126",
      locationInfo: "Dallas, US",
      ipAddress: "10.0.0.3",
    }),
  ];

  const auditLogs = [
    {
      id: "audit-1",
      userId: "admin-1",
      role: "ADMIN",
      action: "SYSTEM_SETTINGS_VIEWED",
      moduleName: "security",
      entityType: "control_plane",
      entityId: "settings",
      oldValue: null,
      newValue: { viewed: true },
      ipAddress: "10.0.0.1",
      deviceInfo: "MacBook Pro",
      createdAt: "2026-07-01T11:45:00.000Z",
      actorName: "Admin User",
      actorEmail: "admin@example.com",
    },
  ];
  const triggerRequests = [
    {
      id: "tr-1",
      customerId: "customer-1",
      nomineeId: "nom-1",
      nomineeUserId: "nominee-user-1",
      nomineeName: "Nominee One",
      nomineeEmail: "nominee@example.com",
      nomineeMobile: null,
      relationship: "spouse",
      customRelationship: null,
      requestKind: "death",
      subjectLine: "Review continuity trigger",
      summary: "Live trigger request for the admin dashboard.",
      priority: "High",
      status: "PENDING",
      submittedAt: "2026-07-01T10:00:00.000Z",
      reviewedAt: null,
      resolvedAt: null,
      cancelledAt: null,
      additionalInfoRequestedAt: null,
      additionalInfoReason: null,
      adminDecisionNote: null,
      latestActivityAt: "2026-07-01T10:00:00.000Z",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z",
      requestedByUserId: "customer-1",
      lastActionByUserId: null,
      lastActionByName: null,
      lastActionRole: "system",
    },
    {
      id: "tr-2",
      customerId: "customer-1",
      nomineeId: "nom-1",
      nomineeUserId: "nominee-user-1",
      nomineeName: "Nominee One",
      nomineeEmail: "nominee@example.com",
      nomineeMobile: null,
      relationship: "spouse",
      customRelationship: null,
      requestKind: "death",
      subjectLine: "Approved trigger",
      summary: "Approved trigger request for reports.",
      priority: "Medium",
      status: "APPROVED",
      submittedAt: "2026-06-30T10:00:00.000Z",
      reviewedAt: "2026-06-30T11:00:00.000Z",
      resolvedAt: "2026-06-30T11:00:00.000Z",
      cancelledAt: null,
      additionalInfoRequestedAt: null,
      additionalInfoReason: null,
      adminDecisionNote: "Approved",
      latestActivityAt: "2026-06-30T11:00:00.000Z",
      createdAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-06-30T11:00:00.000Z",
      requestedByUserId: "customer-1",
      lastActionByUserId: "admin-1",
      lastActionByName: "Admin User",
      lastActionRole: "admin",
    },
    {
      id: "tr-3",
      customerId: "customer-2",
      nomineeId: "nom-2",
      nomineeUserId: "nominee-user-2",
      nomineeName: "Nominee Two",
      nomineeEmail: "nominee2@example.com",
      nomineeMobile: null,
      relationship: "child",
      customRelationship: null,
      requestKind: "medical",
      subjectLine: "Rejected trigger",
      summary: "Rejected trigger request for reports.",
      priority: "Low",
      status: "REJECTED",
      submittedAt: "2026-06-29T10:00:00.000Z",
      reviewedAt: "2026-06-29T11:00:00.000Z",
      resolvedAt: "2026-06-29T11:00:00.000Z",
      cancelledAt: null,
      additionalInfoRequestedAt: null,
      additionalInfoReason: null,
      adminDecisionNote: "Rejected",
      latestActivityAt: "2026-06-29T11:00:00.000Z",
      createdAt: "2026-06-29T10:00:00.000Z",
      updatedAt: "2026-06-29T11:00:00.000Z",
      requestedByUserId: "customer-2",
      lastActionByUserId: "admin-1",
      lastActionByName: "Admin User",
      lastActionRole: "admin",
    },
  ];
  const releases = [
    {
      id: "rel-1",
      triggerRequestId: "tr-2",
      customerId: "customer-1",
      nomineeId: "nom-1",
      nomineeName: "Nominee One",
      nomineeUserId: "nominee-user-1",
      documentId: "doc-1",
      documentTitle: "Will",
      fileName: "will.pdf",
      fileType: "application/pdf",
      fileSize: 512000,
      categoryId: "cat-1",
      categoryName: "Legal",
      canView: true,
      canDownload: true,
      releaseStatus: "RELEASED",
      releaseNotes: "Released for controlled review.",
      releasedBy: "Admin User",
      releasedAt: "2026-06-30T12:00:00.000Z",
      revokedAt: null,
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T12:00:00.000Z",
    },
  ];
  const securityEvents = [
    {
      id: "sec-1",
      userId: "admin-1",
      eventType: "LOGIN_SUCCESS",
      eventDescription: "Admin user authenticated successfully.",
      ipAddress: "10.0.0.1",
      deviceInfo: "MacBook Pro",
      riskLevel: "LOW",
      isResolved: true,
      createdAt: "2026-07-01T11:51:00.000Z",
      actorName: "Admin User",
      actorEmail: "admin@example.com",
    },
  ];
  const notifications = [];

  return {
    sessions,
    auditLogs,
    securityEvents,
    notifications,
    async listPermissionsForUser(userId) {
      if (userId === "super-1") {
        return [...RBAC_ROLE_PERMISSION_KEYS.SUPER_ADMIN];
      }

      return [...RBAC_ROLE_PERMISSION_KEYS.ADMIN];
    },
    async listRolePermissions() {
      return [];
    },
    async listAuditLogs() {
      return [...auditLogs];
    },
    async listSecurityEvents() {
      return [...securityEvents];
    },
    async listSessions() {
      return [...sessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async listNotifications() {
      return [...notifications];
    },
    async listRequestsForAdmin() {
      return [...triggerRequests];
    },
    async listReleasesForAdmin() {
      return [...releases];
    },
    async listPlatformSettings() {
      return [
        {
          id: "setting-1",
          settingKey: "platform_name",
          groupName: "Platform identity",
          label: "Platform name",
          description: "Visible in headers, notifications and exports.",
          value: { value: "INHERIX" },
          editableBy: "SUPER_ADMIN",
          sensitive: false,
          source: "seed",
          updatedBy: null,
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-01T10:00:00.000Z",
        },
      ];
    },
    async upsertPlatformSetting(setting) {
      return {
        id: "setting-1",
        settingKey: setting.settingKey,
        groupName: setting.groupName,
        label: setting.label,
        description: setting.description,
        value: setting.value,
        editableBy: setting.editableBy,
        sensitive: setting.sensitive,
        source: setting.source,
        updatedBy: setting.updatedBy,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-01T10:00:00.000Z",
      };
    },
    async listAdminUsers() {
      return [
        {
          id: "admin-1",
          fullName: "Admin User",
          email: "admin@example.com",
          mobile: null,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          isEmailVerified: true,
          isMobileVerified: false,
          mfaEnabled: true,
          lastLoginAt: "2026-07-01T11:51:00.000Z",
          createdAt: "2026-07-01T11:00:00.000Z",
          updatedAt: "2026-07-01T11:51:00.000Z",
          activeSessionCount: 1,
        },
      ];
    },
    async createAdminUser() {
      return null;
    },
    async updateAdminUser() {
      return null;
    },
    async markNotificationRead() {
      return false;
    },
    async markAllNotificationsRead() {
      return 0;
    },
    async countUnreadNotifications() {
      return 0;
    },
    async countSecurityEvents() {
      return securityEvents.length;
    },
    async countAuditLogs() {
      return auditLogs.length;
    },
    async countSessions() {
      return sessions.length;
    },
    async listPendingTriggerRequests() {
      return triggerRequests.filter((item) => item.status === "PENDING" || item.status === "UNDER_REVIEW" || item.status === "ADDITIONAL_INFO_REQUIRED").map((item) => ({
        id: item.id,
        customerId: item.customerId,
        nomineeId: item.nomineeId,
        nomineeName: item.nomineeName,
        requestKind: item.requestKind,
        subjectLine: item.subjectLine,
        priority: item.priority,
        status: item.status,
        latestActivityAt: item.latestActivityAt,
        createdAt: item.createdAt,
      }));
    },
    async revokeSessionsByDeviceSignature(params) {
      let revoked = 0;
      for (const session of sessions) {
        const matches =
          session.userId === params.userId &&
          session.deviceInfo === params.deviceInfo &&
          session.browserInfo === params.browserInfo &&
          session.locationInfo === params.locationInfo &&
          session.isActive;

        if (matches) {
          session.isActive = false;
          session.revokedAt = "2026-07-01T12:10:00.000Z";
          revoked += 1;
        }
      }

      return revoked;
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push({
        id: `sec-${securityEvents.length + 1}`,
        userId: entry.userId,
        eventType: entry.eventType,
        eventDescription: entry.eventDescription,
        ipAddress: entry.ipAddress,
        deviceInfo: entry.deviceInfo,
        riskLevel: entry.riskLevel,
        isResolved: false,
        createdAt: "2026-07-01T12:10:00.000Z",
        actorName: "Admin User",
        actorEmail: "admin@example.com",
      });
    },
  };
}

async function withServer(dependencies, run) {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger, dependencies);

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("security center exposes canonical device and session ledgers", async () => {
  const principal = createPrincipal();
  const store = createMemoryObservabilityStore();
  const observabilityService = createObservabilityService(testEnv, createLogger("silent"), store);

  await withServer(
    {
      observability: {
        resolveAuthSnapshot: async () => principal,
        observabilityService,
      },
    },
    async (baseUrl) => {
      const eventsResponse = await fetch(`${baseUrl}/api/v1/security/events?limit=25`);
      assert.equal(eventsResponse.status, 200);

      const eventsJson = await eventsResponse.json();
      assert.equal(eventsJson.success, true);
      assert.equal(eventsJson.data.scope, "all");
      assert.ok(Array.isArray(eventsJson.data.events));
      assert.equal(eventsJson.data.events.length, 1);

      const devicesResponse = await fetch(`${baseUrl}/api/v1/security/devices?limit=25`);
      assert.equal(devicesResponse.status, 200);

      const devicesJson = await devicesResponse.json();
      assert.equal(devicesJson.success, true);
      assert.ok(Array.isArray(devicesJson.data.devices));
      assert.equal(devicesJson.data.devices.length, 2);
      assert.equal(devicesJson.data.devices[0].activeSessionCount, 2);

      const sessionsResponse = await fetch(`${baseUrl}/api/v1/security/sessions?limit=25`);
      assert.equal(sessionsResponse.status, 200);

      const sessionsJson = await sessionsResponse.json();
      assert.equal(sessionsJson.success, true);
      assert.ok(Array.isArray(sessionsJson.data.sessions));
      assert.equal(sessionsJson.data.sessions.length, 3);
    }
  );
});

test("admin control plane exposes live dashboard, report and backup snapshots", async () => {
  const principal = createPrincipal("SUPER_ADMIN", "super-1", "super@example.com");
  const store = createMemoryObservabilityStore();
  const observabilityService = createObservabilityService(testEnv, createLogger("silent"), store);

  await withServer(
    {
      observability: {
        resolveAuthSnapshot: async () => principal,
        observabilityService,
      },
    },
    async (baseUrl) => {
      const dashboardResponse = await fetch(`${baseUrl}/api/v1/admin/dashboard`);
      assert.equal(dashboardResponse.status, 200);
      const dashboardJson = await dashboardResponse.json();
      assert.equal(dashboardJson.success, true);
      assert.equal(dashboardJson.data.summary.pendingTriggers, 1);
      assert.equal(dashboardJson.data.summary.approvedTriggers, 1);
      assert.equal(dashboardJson.data.summary.rejectedTriggers, 1);
      assert.equal(dashboardJson.data.recentReleases.length, 1);

      const reportsResponse = await fetch(`${baseUrl}/api/v1/admin/reports`);
      assert.equal(reportsResponse.status, 200);
      const reportsJson = await reportsResponse.json();
      assert.equal(reportsJson.success, true);
      assert.equal(reportsJson.data.triggerReport.rows.length, 3);
      assert.equal(reportsJson.data.releaseReport.rows.length, 1);
      assert.ok(reportsJson.data.auditReport.rows.length >= 0);

      const settingsResponse = await fetch(`${baseUrl}/api/v1/admin/settings`);
      assert.equal(settingsResponse.status, 200);
      const settingsJson = await settingsResponse.json();
      assert.equal(settingsJson.success, true);
      assert.ok(Array.isArray(settingsJson.data.groups));
      assert.ok(settingsJson.data.groups.length > 0);

      const backupResponse = await fetch(`${baseUrl}/api/v1/admin/backup`);
      assert.equal(backupResponse.status, 200);
      const backupJson = await backupResponse.json();
      assert.equal(backupJson.success, true);
      assert.ok(Array.isArray(backupJson.data.artifacts));
      assert.ok(backupJson.data.artifacts.length > 0);

      const exportResponse = await fetch(`${baseUrl}/api/v1/audit-logs/export`);
      assert.equal(exportResponse.status, 200);
      assert.equal(exportResponse.headers.get("content-type")?.includes("text/csv"), true);
      const exportText = await exportResponse.text();
      assert.ok(exportText.includes("id,occurredAt"));
    }
  );
});

test("security device revocation closes matching sessions and writes an audit trail", async () => {
  const principal = createPrincipal();
  const store = createMemoryObservabilityStore();
  const observabilityService = createObservabilityService(testEnv, createLogger("silent"), store);

  await withServer(
    {
      observability: {
        resolveAuthSnapshot: async () => principal,
        observabilityService,
      },
    },
    async (baseUrl) => {
      const devicesResponse = await fetch(`${baseUrl}/api/v1/security/devices?limit=25`);
      const devicesJson = await devicesResponse.json();
      const deviceId = devicesJson.data.devices[0].id;

      const revokeResponse = await fetch(`${baseUrl}/api/v1/security/devices/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      });

      assert.equal(revokeResponse.status, 200);

      const revokeJson = await revokeResponse.json();
      assert.equal(revokeJson.success, true);
      assert.equal(revokeJson.data.deviceId, deviceId);
      assert.equal(revokeJson.data.revokedSessionCount, 2);

      const refreshedSessionsResponse = await fetch(`${baseUrl}/api/v1/security/sessions?limit=25`);
      const refreshedSessionsJson = await refreshedSessionsResponse.json();
      const revokedSessions = refreshedSessionsJson.data.sessions.filter((session) => session.deviceInfo === "MacBook Pro");

      assert.equal(revokedSessions.every((session) => session.revokedAt), true);
      assert.equal(store.auditLogs.at(-1).action, "SECURITY_DEVICE_REVOKED");
      assert.equal(store.securityEvents.at(-1).eventType, "SECURITY_DEVICE_REVOKED");
    }
  );
});
