import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { hashPassword, passwordPolicyViolations, verifyPassword } from "../../lib/password.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext, PublicUser, UserRole } from "../auth/types.js";
import { createRbacService } from "../rbac/rbac.service.js";
import { HttpError } from "../../utils/http.js";
import type { ObservabilityStore } from "../observability/observability.store.js";
import type {
  ProfileAccountSummary,
  ProfileAccountUpdateInput,
  ProfileHardeningSummary,
  ProfilePasswordChangeInput,
  ProfileRecoveryCodeSummary,
  ProfilePreferencesRecord,
  ProfilePreferencesUpdateInput,
  ProfilePrivacyDeletionRequestInput,
  ProfilePrivacyExportRequestInput,
  ProfilePrivacyRequest,
  ProfilePrivacyUpdateInput,
  ProfileRole,
  ProfileSectionDefinition,
  ProfileSecurityAlert,
  ProfileSnapshot,
  ProfileTrustedDevice,
} from "./types.js";
import { PROFILE_AUDIT_ACTIONS, PROFILE_SECTION_VISIBILITY } from "./types.js";
import type { ProfileStore } from "./profile.store.js";

export type ProfileServiceDependencies = {
  authStore: Pick<
    AuthStore,
    | "findUserById"
    | "updateUser"
    | "listActiveSessions"
    | "listSessions"
    | "revokeSession"
    | "revokeAllUserSessions"
    | "trustSessionById"
    | "revokeTrustedSessionById"
    | "listAuthTokensByPurpose"
    | "revokeAuthTokensByPurpose"
    | "createAuthToken"
    | "insertAuditLog"
    | "insertSecurityEvent"
    | "resolveSecurityEvent"
    | "createNotification"
  >;
  observabilityStore: Pick<
    ObservabilityStore,
    "listNotifications" | "listSecurityEvents" | "countUnreadNotifications" | "countSessions"
  >;
  profileStore: ProfileStore;
  rbacService: ReturnType<typeof createRbacService>;
};

export type ProfilePrincipal = {
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

type ProfileNotificationRow = Awaited<ReturnType<ObservabilityStore["listNotifications"]>>[number];
type ProfileSecurityEventRow = Awaited<ReturnType<ObservabilityStore["listSecurityEvents"]>>[number];
type ProfileSessionRow = Awaited<ReturnType<AuthStore["listSessions"]>>[number];
type ProfilePrivacyRequestRow = Awaited<ReturnType<ProfileStore["listPrivacyRequests"]>>[number];

function toProfileSession(row: ProfileSessionRow) {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
    role: toProfileRole(row.role),
    ipAddress: row.ipAddress,
    deviceInfo: row.deviceInfo,
    browserInfo: row.browserInfo,
    locationInfo: row.locationInfo,
    isActive: row.isActive,
    trustedAt: row.trustedAt,
    trustRevokedAt: row.trustRevokedAt,
    trustLabel: row.trustLabel,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    rotatedAt: row.rotatedAt,
  };
}

function buildDeviceSignature(session: ReturnType<typeof toProfileSession>) {
  return [session.userId, session.deviceInfo ?? "", session.browserInfo ?? "", session.locationInfo ?? ""].join("|");
}

function buildRecoveryCodeSignature(code: string) {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function formatRecoveryCode(token: string) {
  const normalized = buildRecoveryCodeSignature(token);
  const padded = `${normalized}XXXX`.slice(0, 16);
  return padded.match(/.{1,4}/g)?.join("-") ?? padded;
}

function deriveDeviceHistory(sessions: ReturnType<typeof toProfileSession>[]) {
  if (!sessions.length) {
    return [];
  }

  const groups = new Map<string, ReturnType<typeof toProfileSession>[]>();

  for (const session of sessions) {
    const signature = buildDeviceSignature(session);
    const group = groups.get(signature) ?? [];
    group.push(session);
    groups.set(signature, group);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = [...group].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const latest = sorted[0];
      const earliest = sorted[sorted.length - 1] ?? latest;
      const activeSessionCount = sorted.filter((item) => item.isActive).length;

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
        totalSessionCount: sorted.length,
        isActive: activeSessionCount > 0,
      };
    })
    .sort((left, right) => right.lastLoginAt.localeCompare(left.lastLoginAt));
}

function deriveTrustedDevices(sessions: ReturnType<typeof toProfileSession>[]): ProfileTrustedDevice[] {
  const trusted = sessions.filter((session) => session.trustedAt && !session.trustRevokedAt);

  if (!trusted.length) {
    return [];
  }

  const grouped = new Map<string, ReturnType<typeof toProfileSession>[]>();

  for (const session of trusted) {
    const signature = buildDeviceSignature(session);
    const group = grouped.get(signature) ?? [];
    group.push(session);
    grouped.set(signature, group);
  }

  return [...grouped.values()]
    .map((group) => {
      const sorted = [...group].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const latest = sorted[0];
      const earliestTrusted = sorted[sorted.length - 1] ?? latest;

      return {
        id: sha256Hex(buildDeviceSignature(latest)),
        sessionId: latest.id,
        deviceInfo: latest.deviceInfo,
        browserInfo: latest.browserInfo,
        locationInfo: latest.locationInfo,
        ipAddress: latest.ipAddress,
        trustedAt: latest.trustedAt ?? earliestTrusted.trustedAt ?? latest.createdAt,
        trustLabel: latest.trustLabel,
        lastSeenAt: latest.createdAt,
        isTrusted: true,
      };
    })
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
}

function isLoginHistoryEvent(eventType: string) {
  return eventType.startsWith("LOGIN_") || eventType === "TOKEN_REFRESHED";
}

function isSuspiciousLoginEvent(eventType: string) {
  return eventType.startsWith("LOGIN_") || eventType === "SUSPICIOUS_LOGIN_DETECTED";
}

function isHardeningAlert(event: ProfileSecurityEventRow) {
  return !event.isResolved && (event.riskLevel === "HIGH" || event.riskLevel === "MEDIUM");
}

function mapSecurityAlert(event: ProfileSecurityEventRow): ProfileSecurityAlert {
  return mapSecurityEvent(event);
}

function toProfileRole(role: UserRole): ProfileRole {
  return role as ProfileRole;
}

function getSectionDefinitions(role: ProfileRole): ProfileSectionDefinition[] {
  const visibleSections = PROFILE_SECTION_VISIBILITY[role] ?? [];

  return [
    {
      id: "account",
      title: "Account",
      summary: "Identity, contact information and account metadata.",
      visible: visibleSections.includes("account"),
      reason: "Always available for the signed-in user.",
    },
    {
      id: "security",
      title: "Security",
      summary: "Password, sessions and trusted-device controls.",
      visible: visibleSections.includes("security"),
      reason: "Always available for the signed-in user.",
    },
    {
      id: "notifications",
      title: "Notifications",
      summary: "Workflow, security and release delivery preferences.",
      visible: visibleSections.includes("notifications"),
      reason: "Always available for the signed-in user.",
    },
    {
      id: "privacy",
      title: "Privacy",
      summary: "Data-sharing and export controls.",
      visible: visibleSections.includes("privacy"),
      reason:
        visibleSections.includes("privacy")
          ? "Available to owner and administrative roles."
          : "Restricted for this role to avoid exposing owner-only privacy controls.",
    },
  ];
}

function assertSectionVisible(role: ProfileRole, sectionId: ProfileSectionDefinition["id"]) {
  const section = getSectionDefinitions(role).find((item) => item.id === sectionId);

  if (!section?.visible) {
    throw new HttpError(403, "FORBIDDEN", "This profile section is not available for the current role.");
  }
}

function canAccessHardening(role: ProfileRole) {
  return role === "CUSTOMER" || role === "ADMIN" || role === "SUPER_ADMIN";
}

function assertHardeningVisible(role: ProfileRole) {
  if (!canAccessHardening(role)) {
    throw new HttpError(403, "FORBIDDEN", "Security hardening controls are not available for the current role.");
  }
}

function toAccountSummary(user: NonNullable<Awaited<ReturnType<AuthStore["findUserById"]>>>): ProfileAccountSummary {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    status: user.status,
    isEmailVerified: user.isEmailVerified,
    isMobileVerified: user.isMobileVerified,
    mfaEnabled: user.mfaEnabled,
    initials:
      user.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "IN",
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapNotification(row: ProfileNotificationRow) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    channel: row.channel,
    status: row.status,
    readAt: row.readAt,
    sentAt: row.sentAt,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

function mapSecurityEvent(row: ProfileSecurityEventRow) {
  return {
    id: row.id,
    eventType: row.eventType,
    eventDescription: row.eventDescription,
    riskLevel: row.riskLevel,
    isResolved: row.isResolved,
    createdAt: row.createdAt,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
  };
}

function mapPrivacyRequest(row: ProfilePrivacyRequestRow): ProfilePrivacyRequest {
  return {
    id: row.id,
    requestType: row.requestType,
    status: row.status,
    reason: row.reason,
    exportFormat: row.exportFormat,
    exportPayload: null,
    reviewNotes: row.reviewNotes,
    requestedAt: row.requestedAt,
    reviewedAt: row.reviewedAt,
    completedAt: row.completedAt,
    reviewedByUserId: row.reviewedByUserId,
    reviewedByRole: row.reviewedByRole,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildNotificationPreferences(preferences: ProfilePreferencesRecord) {
  return {
    emailEnabled: preferences.emailEnabled,
    smsEnabled: preferences.smsEnabled,
    inAppEnabled: preferences.inAppEnabled,
    workflowEnabled: preferences.workflowEnabled,
    securityEnabled: preferences.securityEnabled,
    releaseEnabled: preferences.releaseEnabled,
    complianceEnabled: preferences.complianceEnabled,
  };
}

function buildPrivacyPreferences(preferences: ProfilePreferencesRecord) {
  return {
    shareContactWithNominees: preferences.shareContactWithNominees,
    shareActivityWithNominees: preferences.shareActivityWithNominees,
    allowDataExports: preferences.allowDataExports,
    allowTrustedDeviceTracking: preferences.allowTrustedDeviceTracking,
  };
}

function buildRecoveryCodeSummary(tokens: Awaited<ReturnType<AuthStore["listAuthTokensByPurpose"]>>): ProfileRecoveryCodeSummary {
  const activeTokens = tokens.filter((token) => !token.usedAt && new Date(token.expiresAt).getTime() > Date.now());
  const lastGeneratedAt = tokens[0]?.createdAt ?? null;
  const expiresAt = activeTokens[0]?.expiresAt ?? null;

  return {
    remainingCount: activeTokens.length,
    lastGeneratedAt,
    expiresAt,
    rotationRecommended: activeTokens.length === 0 || (lastGeneratedAt ? Date.now() - new Date(lastGeneratedAt).getTime() > 90 * 24 * 60 * 60 * 1000 : true),
  };
}

function buildSecurityHardening(
  sessions: ReturnType<typeof toProfileSession>[],
  tokens: Awaited<ReturnType<AuthStore["listAuthTokensByPurpose"]>>,
  securityEvents: ProfileSecurityEventRow[],
  role: ProfileRole
): ProfileHardeningSummary {
  const trustedDevices = deriveTrustedDevices(sessions);
  const suspiciousLogins = securityEvents
    .filter((event) => isSuspiciousLoginEvent(event.eventType) && isHardeningAlert(event))
    .map(mapSecurityAlert);
  const recentAlerts = securityEvents
    .filter((event) => isHardeningAlert(event))
    .map(mapSecurityAlert)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);

  return {
    recoveryCodes: buildRecoveryCodeSummary(tokens),
    trustedDevices: role === "NOMINEE" ? [] : trustedDevices,
    suspiciousLogins: role === "NOMINEE" ? [] : suspiciousLogins,
    recentAlerts: role === "NOMINEE" ? [] : recentAlerts,
  };
}

async function logProfileEvent(
  store: ProfileServiceDependencies["authStore"],
  input: {
    userId: string | null;
    role: UserRole | null;
    action: string;
    entityType: string;
    entityId: string | null;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    ipAddress: string | null;
    deviceInfo: string | null;
    eventType?: string | null;
    eventDescription?: string | null;
    riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  }
) {
  await store.insertAuditLog({
    userId: input.userId,
    role: input.role,
    action: input.action,
    moduleName: "profile",
    entityType: input.entityType,
    entityId: input.entityId,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    ipAddress: input.ipAddress,
    deviceInfo: input.deviceInfo,
  });

  if (input.eventType) {
    await store.insertSecurityEvent({
      userId: input.userId,
      eventType: input.eventType,
      eventDescription: input.eventDescription ?? null,
      ipAddress: input.ipAddress,
      deviceInfo: input.deviceInfo,
      riskLevel: input.riskLevel ?? "LOW",
    });
  }
}

function buildProfileEnvelope(
  message: string,
  profile: ProfileSnapshot,
  requestId: string,
  extra?: Record<string, unknown>
) {
  return {
    success: true,
    message,
    data: {
      profile,
      ...(extra ?? {}),
    },
    timestamp: new Date().toISOString(),
    requestId,
  };
}

function buildProfileError(message: string, errorCode: string, requestId: string) {
  return {
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function createProfileService(env: AppEnv, logger: Logger, dependencies: ProfileServiceDependencies) {
  const rbac = dependencies.rbacService;

  async function getPrincipalPermissions(principal: ProfilePrincipal) {
    const permissions = await rbac.getPrincipalPermissions(principal);
    return permissions.length ? permissions : [];
  }

  async function loadProfile(principal: ProfilePrincipal): Promise<ProfileSnapshot> {
    const permissions = await getPrincipalPermissions(principal);
    const user = await dependencies.authStore.findUserById(principal.user.id);

    if (!user) {
      throw new Error("Authenticated user could not be loaded.");
    }

    const preferences = await dependencies.profileStore.getPreferences(user.id);
    const [
      notifications,
      securityEvents,
      sessions,
      recoveryTokens,
      privacyRequests,
      activeSessionCount,
      totalSessionCount,
      unreadCount,
    ] = await Promise.all([
      dependencies.observabilityStore.listNotifications({ userId: user.id, limit: 8 }),
      dependencies.observabilityStore.listSecurityEvents({ userId: user.id, limit: 25 }),
      dependencies.authStore.listSessions(user.id),
      dependencies.authStore.listAuthTokensByPurpose(user.id, "RECOVERY_CODE"),
      dependencies.profileStore.listPrivacyRequests(user.id, 8),
      dependencies.observabilityStore.countSessions(user.id, true),
      dependencies.observabilityStore.countSessions(user.id, false),
      dependencies.observabilityStore.countUnreadNotifications(user.id),
    ]);

    const profileSessions = sessions.map(toProfileSession);
    const activeSessions = profileSessions.filter((session) => session.isActive);
    const deviceHistory = deriveDeviceHistory(profileSessions);
    const loginHistory = securityEvents.filter((event) => isLoginHistoryEvent(event.eventType)).map(mapSecurityEvent);
    const hardening = buildSecurityHardening(profileSessions, recoveryTokens, securityEvents, toProfileRole(user.role));

    return {
      role: toProfileRole(user.role),
      sections: getSectionDefinitions(toProfileRole(user.role)),
      account: toAccountSummary(user),
      security: {
        mfaEnabled: user.mfaEnabled,
        activeSessionCount,
        totalSessionCount,
        recentSessions: activeSessions,
        sessionHistory: profileSessions,
        deviceHistory,
        loginHistory,
        recentSecurityEvents: securityEvents.map(mapSecurityEvent),
        trustedDeviceTrackingEnabled: preferences.allowTrustedDeviceTracking,
        recoveryCodes: hardening.recoveryCodes,
        trustedDevices: hardening.trustedDevices,
        suspiciousLogins: hardening.suspiciousLogins,
        recentAlerts: hardening.recentAlerts,
        passwordLastChangedAt: null,
      },
      hardening,
      notifications: {
        unreadCount,
        recentNotifications: notifications.map(mapNotification),
        lastReviewedAt: preferences.lastReviewedAt,
        preferences: buildNotificationPreferences(preferences),
      },
      privacy: {
        preferences: buildPrivacyPreferences(preferences),
        requests: privacyRequests.map(mapPrivacyRequest),
        lastReviewedAt: preferences.lastReviewedAt,
        retentionNote: "Preferences and privacy requests are retained in the profile ledger and audited on every mutation.",
      },
      effectivePermissions: permissions,
    };
  }

  function assertSelf(principal: ProfilePrincipal, userId: string) {
    if (principal.user.id !== userId) {
      throw new Error("Profile updates are restricted to the signed-in account.");
    }
  }

  async function updateAccount(
    principal: ProfilePrincipal,
    input: ProfileAccountUpdateInput,
    context: AuthRequestContext
  ) {
    assertSelf(principal, principal.user.id);
    const user = await dependencies.authStore.findUserById(principal.user.id);
    if (!user) {
      throw new Error("Authenticated user could not be loaded.");
    }

    const nextFullName = input.fullName.trim();
    const nextMobile = input.mobile?.trim() || null;
    if (!nextFullName) {
      return {
        statusCode: 400,
        body: buildProfileError("Full name is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const nextUser = await dependencies.authStore.updateUser(user.id, {
      fullName: nextFullName,
      mobile: nextMobile,
    });

    if (!nextUser) {
      return {
        statusCode: 500,
        body: buildProfileError("Profile could not be updated.", "PROFILE_UPDATE_FAILED", context.requestId),
      };
    }

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.ACCOUNT_UPDATED,
      entityType: "profile_account",
      entityId: user.id,
      oldValue: {
        fullName: user.fullName,
        mobile: user.mobile,
      },
      newValue: {
        fullName: nextUser.fullName,
        mobile: nextUser.mobile,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.ACCOUNT_UPDATED,
      eventDescription: "Profile account details were updated.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope(
        "Account details updated.",
        await loadProfile(principal),
        context.requestId
      ),
    };
  }

  async function updateNotificationPreferences(
    principal: ProfilePrincipal,
    input: ProfilePreferencesUpdateInput,
    context: AuthRequestContext
  ) {
    const current = await dependencies.profileStore.getPreferences(principal.user.id);
    const updated = await dependencies.profileStore.updatePreferences(principal.user.id, input);

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.NOTIFICATIONS_UPDATED,
      entityType: "profile_preferences",
      entityId: principal.user.id,
      oldValue: {
        emailEnabled: current.emailEnabled,
        smsEnabled: current.smsEnabled,
        inAppEnabled: current.inAppEnabled,
        workflowEnabled: current.workflowEnabled,
        securityEnabled: current.securityEnabled,
        releaseEnabled: current.releaseEnabled,
        complianceEnabled: current.complianceEnabled,
      },
      newValue: {
        emailEnabled: updated.emailEnabled,
        smsEnabled: updated.smsEnabled,
        inAppEnabled: updated.inAppEnabled,
        workflowEnabled: updated.workflowEnabled,
        securityEnabled: updated.securityEnabled,
        releaseEnabled: updated.releaseEnabled,
        complianceEnabled: updated.complianceEnabled,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
    });

    await dependencies.authStore.createNotification({
      userId: principal.user.id,
      title: "Notification preferences updated",
      message: "Your profile notification settings were updated and recorded in the audit trail.",
      channel: "IN_APP",
      metadata: {
        source: "profile",
        category: "preferences",
        actionLabel: "Review preferences",
      },
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope(
        "Notification preferences updated.",
        await loadProfile(principal),
        context.requestId
      ),
    };
  }

  async function updatePrivacyPreferences(
    principal: ProfilePrincipal,
    input: ProfilePrivacyUpdateInput,
    context: AuthRequestContext
  ) {
    assertSectionVisible(toProfileRole(principal.user.role), "privacy");

    const current = await dependencies.profileStore.getPreferences(principal.user.id);
    const updated = await dependencies.profileStore.updatePrivacy(principal.user.id, input);

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.PRIVACY_UPDATED,
      entityType: "profile_preferences",
      entityId: principal.user.id,
      oldValue: {
        shareContactWithNominees: current.shareContactWithNominees,
        shareActivityWithNominees: current.shareActivityWithNominees,
        allowDataExports: current.allowDataExports,
        allowTrustedDeviceTracking: current.allowTrustedDeviceTracking,
      },
      newValue: {
        shareContactWithNominees: updated.shareContactWithNominees,
        shareActivityWithNominees: updated.shareActivityWithNominees,
        allowDataExports: updated.allowDataExports,
        allowTrustedDeviceTracking: updated.allowTrustedDeviceTracking,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope("Privacy preferences updated.", await loadProfile(principal), context.requestId),
    };
  }

  async function requestPrivacyDataExport(
    principal: ProfilePrincipal,
    input: ProfilePrivacyExportRequestInput,
    context: AuthRequestContext
  ) {
    assertSectionVisible(toProfileRole(principal.user.role), "privacy");

    const preferences = await dependencies.profileStore.getPreferences(principal.user.id);
    if (!preferences.allowDataExports) {
      return {
        statusCode: 403,
        body: buildProfileError("Data exports are disabled for this profile.", "DATA_EXPORTS_DISABLED", context.requestId),
      };
    }

    const profile = await loadProfile(principal);
    const reason = input.reason?.trim() || null;
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      exportedBy: {
        userId: principal.user.id,
        role: principal.user.role,
        email: principal.user.email,
      },
      exportType: "PROFILE_PRIVACY_EXPORT",
      profile,
      request: {
        reason,
      },
    };

    const requestRecord = await dependencies.profileStore.createPrivacyExportRequest(principal.user.id, {
      reason,
      exportPayload,
    });

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.PRIVACY_EXPORT_REQUESTED,
      entityType: "privacy_request",
      entityId: requestRecord.id,
      oldValue: null,
      newValue: {
        requestType: requestRecord.requestType,
        status: requestRecord.status,
        reason: requestRecord.reason,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.PRIVACY_EXPORT_REQUESTED,
      eventDescription: "A profile data export was requested and prepared.",
      riskLevel: "LOW",
    });

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.PRIVACY_EXPORT_COMPLETED,
      entityType: "privacy_request",
      entityId: requestRecord.id,
      oldValue: {
        status: "REQUESTED",
      },
      newValue: {
        status: requestRecord.status,
        exportFormat: requestRecord.exportFormat,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.PRIVACY_EXPORT_COMPLETED,
      eventDescription: "A profile data export was completed and stored in the request ledger.",
      riskLevel: "LOW",
    });

    await dependencies.authStore.createNotification({
      userId: principal.user.id,
      title: "Profile export ready",
      message: "Your profile export was prepared and recorded in the privacy ledger.",
      channel: "IN_APP",
      metadata: {
        source: "profile",
        category: "privacy",
        requestId: requestRecord.id,
        requestType: requestRecord.requestType,
      },
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope(
        "Profile export requested.",
        await loadProfile(principal),
        context.requestId,
        { request: requestRecord }
      ),
    };
  }

  async function requestPrivacyDeletion(
    principal: ProfilePrincipal,
    input: ProfilePrivacyDeletionRequestInput,
    context: AuthRequestContext
  ) {
    assertSectionVisible(toProfileRole(principal.user.role), "privacy");

    const recentRequests = await dependencies.profileStore.listPrivacyRequests(principal.user.id, 20);
    const activeDeletionRequest = recentRequests.find(
      (request) => request.requestType === "ACCOUNT_DELETION" && request.status === "REQUESTED"
    );
    if (activeDeletionRequest) {
      return {
        statusCode: 409,
        body: buildProfileError(
          "A deletion request is already in progress.",
          "PRIVACY_DELETION_ALREADY_REQUESTED",
          context.requestId
        ),
      };
    }

    const reason = input.reason?.trim() || null;

    const requestRecord = await dependencies.profileStore.createPrivacyDeletionRequest(principal.user.id, {
      reason,
    });

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.PRIVACY_DELETION_REQUESTED,
      entityType: "privacy_request",
      entityId: requestRecord.id,
      oldValue: null,
      newValue: {
        requestType: requestRecord.requestType,
        status: requestRecord.status,
        reason: requestRecord.reason,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.PRIVACY_DELETION_REQUESTED,
      eventDescription: "An account deletion request was submitted for review.",
      riskLevel: "MEDIUM",
    });

    await dependencies.authStore.createNotification({
      userId: principal.user.id,
      title: "Deletion request received",
      message: "Your account deletion request has been recorded and will follow the governed review path.",
      channel: "IN_APP",
      metadata: {
        source: "profile",
        category: "privacy",
        requestId: requestRecord.id,
        requestType: requestRecord.requestType,
      },
    });

    return {
      statusCode: 201,
      body: buildProfileEnvelope(
        "Account deletion request submitted.",
        await loadProfile(principal),
        context.requestId,
        { request: requestRecord }
      ),
    };
  }

  async function changePassword(
    principal: ProfilePrincipal,
    input: ProfilePasswordChangeInput,
    context: AuthRequestContext
  ) {
    const user = await dependencies.authStore.findUserById(principal.user.id);
    if (!user) {
      return {
        statusCode: 404,
        body: buildProfileError("Profile not found.", "PROFILE_NOT_FOUND", context.requestId),
      };
    }

    if (!input.currentPassword.trim() || !input.newPassword.trim()) {
      return {
        statusCode: 400,
        body: buildProfileError("Current and new password are required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const currentMatches = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!currentMatches) {
      await logProfileEvent(dependencies.authStore, {
        userId: principal.user.id,
        role: principal.user.role,
        action: PROFILE_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED,
        entityType: "profile_security",
        entityId: principal.user.id,
        oldValue: null,
        newValue: { denied: true },
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED,
      eventDescription: "Password change was rejected because the current password did not match.",
      riskLevel: "HIGH",
    });

      return {
        statusCode: 401,
        body: buildProfileError("Current password is incorrect.", "INVALID_CREDENTIALS", context.requestId),
      };
    }

    const violations = passwordPolicyViolations(input.newPassword);
    if (violations.length) {
      return {
        statusCode: 400,
        body: buildProfileError(violations[0] ?? "Password policy failed.", "PASSWORD_POLICY_VIOLATION", context.requestId),
      };
    }

    const passwordHash = await hashPassword(input.newPassword);
    const updated = await dependencies.authStore.updateUser(user.id, { passwordHash });
    await dependencies.authStore.revokeAllUserSessions(user.id, "Password changed from the profile center.");

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: "profile_security",
      entityId: user.id,
      oldValue: {
        passwordHash: sha256Hex(user.passwordHash),
      },
      newValue: {
        passwordHash: sha256Hex(updated?.passwordHash ?? passwordHash),
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.PASSWORD_CHANGED,
      eventDescription: "Profile password changed and sessions were revoked.",
      riskLevel: "HIGH",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope("Password changed. Please sign in again on other devices.", await loadProfile(principal), context.requestId),
    };
  }

  async function revokeAllSessions(
    principal: ProfilePrincipal,
    context: AuthRequestContext
  ) {
    const user = await dependencies.authStore.findUserById(principal.user.id);
    if (!user) {
      return {
        statusCode: 404,
        body: buildProfileError("Profile not found.", "PROFILE_NOT_FOUND", context.requestId),
      };
    }

    const activeSessionCountBefore = await dependencies.observabilityStore.countSessions(user.id, true);
    const totalSessionCountBefore = await dependencies.observabilityStore.countSessions(user.id, false);
    const revokedCount = await dependencies.authStore.revokeAllUserSessions(user.id, "Revoked from the profile security center.");

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.SESSIONS_REVOKED,
      entityType: "session",
      entityId: user.id,
      oldValue: {
        activeSessionCount: activeSessionCountBefore,
        totalSessionCount: totalSessionCountBefore,
      },
      newValue: {
        activeSessionCount: 0,
        totalSessionCount: totalSessionCountBefore,
        revokedCount,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.SESSIONS_REVOKED,
      eventDescription: "All active sessions were revoked from the profile center.",
      riskLevel: "MEDIUM",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope(
        revokedCount > 0 ? "All active sessions were revoked." : "No active sessions were found to revoke.",
        await loadProfile(principal),
        context.requestId
      ),
    };
  }

  async function rotateRecoveryCodes(principal: ProfilePrincipal, context: AuthRequestContext) {
    assertHardeningVisible(toProfileRole(principal.user.role));
    const user = await dependencies.authStore.findUserById(principal.user.id);

    if (!user) {
      return {
        statusCode: 404,
        body: buildProfileError("Profile not found.", "PROFILE_NOT_FOUND", context.requestId),
      };
    }

    if (!user.mfaEnabled) {
      return {
        statusCode: 400,
        body: buildProfileError("Enable MFA before generating recovery codes.", "MFA_REQUIRED", context.requestId),
      };
    }

    const revokedCount = await dependencies.authStore.revokeAuthTokensByPurpose(user.id, "RECOVERY_CODE");
    const recoveryCodes = Array.from({ length: 10 }, () => formatRecoveryCode(randomToken(8)));
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    for (const recoveryCode of recoveryCodes) {
      await dependencies.authStore.createAuthToken({
        userId: user.id,
        tokenHash: sha256Hex(buildRecoveryCodeSignature(recoveryCode)),
        purpose: "RECOVERY_CODE",
        expiresAt,
        metadata: {
          generatedFor: "profile_security_hardening",
          source: "profile",
        },
      });
    }

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.RECOVERY_CODES_ROTATED,
      entityType: "profile_security",
      entityId: user.id,
      oldValue: {
        revokedCount,
      },
      newValue: {
        generatedCount: recoveryCodes.length,
        expiresAt: expiresAt.toISOString(),
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.RECOVERY_CODES_ROTATED,
      eventDescription: "Recovery codes were rotated from the profile hardening center.",
      riskLevel: "HIGH",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope(
        "Recovery codes rotated.",
        await loadProfile(principal),
        context.requestId,
        { generatedRecoveryCodes: recoveryCodes }
      ),
    };
  }

  async function trustDevice(
    principal: ProfilePrincipal,
    sessionId: string,
    label: string | null,
    context: AuthRequestContext
  ) {
    assertHardeningVisible(toProfileRole(principal.user.role));

    if (!sessionId.trim()) {
      return {
        statusCode: 400,
        body: buildProfileError("sessionId is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const sessions = await dependencies.authStore.listSessions(principal.user.id);
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return {
        statusCode: 404,
        body: buildProfileError("Session not found.", "SESSION_NOT_FOUND", context.requestId),
      };
    }

    const updated = await dependencies.authStore.trustSessionById(sessionId, label ?? session.trustLabel ?? session.deviceInfo ?? "Trusted device");

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.TRUSTED_DEVICE_GRANTED,
      entityType: "trusted_device",
      entityId: sessionId,
      oldValue: {
        trustedAt: session.trustedAt,
        trustRevokedAt: session.trustRevokedAt,
      },
      newValue: {
        trustedAt: updated?.trustedAt ?? new Date().toISOString(),
        trustLabel: updated?.trustLabel ?? label ?? session.deviceInfo ?? "Trusted device",
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.TRUSTED_DEVICE_GRANTED,
      eventDescription: "A device was marked as trusted from the profile hardening center.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope("Trusted device saved.", await loadProfile(principal), context.requestId),
    };
  }

  async function revokeTrustedDevice(
    principal: ProfilePrincipal,
    sessionId: string,
    context: AuthRequestContext
  ) {
    assertHardeningVisible(toProfileRole(principal.user.role));

    if (!sessionId.trim()) {
      return {
        statusCode: 400,
        body: buildProfileError("sessionId is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const sessions = await dependencies.authStore.listSessions(principal.user.id);
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return {
        statusCode: 404,
        body: buildProfileError("Trusted device not found.", "TRUSTED_DEVICE_NOT_FOUND", context.requestId),
      };
    }

    const updated = await dependencies.authStore.revokeTrustedSessionById(sessionId);

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.TRUSTED_DEVICE_REVOKED,
      entityType: "trusted_device",
      entityId: sessionId,
      oldValue: {
        trustedAt: session.trustedAt,
        trustRevokedAt: session.trustRevokedAt,
      },
      newValue: {
        trustRevokedAt: updated?.trustRevokedAt ?? new Date().toISOString(),
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.TRUSTED_DEVICE_REVOKED,
      eventDescription: "A trusted device was revoked from the profile hardening center.",
      riskLevel: "MEDIUM",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope("Trusted device revoked.", await loadProfile(principal), context.requestId),
    };
  }

  async function acknowledgeSecurityAlert(
    principal: ProfilePrincipal,
    eventId: string,
    context: AuthRequestContext
  ) {
    assertHardeningVisible(toProfileRole(principal.user.role));

    if (!eventId.trim()) {
      return {
        statusCode: 400,
        body: buildProfileError("eventId is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const securityEvents = await dependencies.observabilityStore.listSecurityEvents({ userId: principal.user.id, limit: 100 });
    const event = securityEvents.find((item) => item.id === eventId);
    if (!event) {
      return {
        statusCode: 404,
        body: buildProfileError("Security alert not found.", "SECURITY_ALERT_NOT_FOUND", context.requestId),
      };
    }

    const resolved = await dependencies.authStore.resolveSecurityEvent(eventId, principal.user.id);
    if (!resolved) {
      return {
        statusCode: 500,
        body: buildProfileError("Security alert could not be acknowledged.", "SECURITY_ALERT_ACK_FAILED", context.requestId),
      };
    }

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.SECURITY_ALERT_ACKNOWLEDGED,
      entityType: "security_event",
      entityId: eventId,
      oldValue: {
        isResolved: event.isResolved,
      },
      newValue: {
        isResolved: true,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.SECURITY_ALERT_ACKNOWLEDGED,
      eventDescription: "A security alert was acknowledged from the profile hardening center.",
      riskLevel: "LOW",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope("Security alert acknowledged.", await loadProfile(principal), context.requestId),
    };
  }

  async function setMfaEnabled(
    principal: ProfilePrincipal,
    enabled: boolean,
    context: AuthRequestContext
  ) {
    const user = await dependencies.authStore.findUserById(principal.user.id);
    if (!user) {
      return {
        statusCode: 404,
        body: buildProfileError("Profile not found.", "PROFILE_NOT_FOUND", context.requestId),
      };
    }

    if (user.mfaEnabled === enabled) {
      return {
        statusCode: 200,
        body: buildProfileEnvelope(
          enabled ? "MFA is already enabled." : "MFA is already disabled.",
          await loadProfile(principal),
          context.requestId
        ),
      };
    }

    const updated = await dependencies.authStore.updateUser(user.id, { mfaEnabled: enabled });
    if (!updated) {
      return {
        statusCode: 500,
        body: buildProfileError("MFA setting could not be updated.", "PROFILE_UPDATE_FAILED", context.requestId),
      };
    }

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: enabled ? PROFILE_AUDIT_ACTIONS.MFA_ENABLED : PROFILE_AUDIT_ACTIONS.MFA_DISABLED,
      entityType: "profile_security",
      entityId: user.id,
      oldValue: { mfaEnabled: user.mfaEnabled },
      newValue: { mfaEnabled: enabled },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: enabled ? PROFILE_AUDIT_ACTIONS.MFA_ENABLED : PROFILE_AUDIT_ACTIONS.MFA_DISABLED,
      eventDescription: enabled ? "MFA was enabled from the profile center." : "MFA was disabled from the profile center.",
      riskLevel: enabled ? "LOW" : "HIGH",
    });

    await dependencies.authStore.createNotification({
      userId: principal.user.id,
      title: enabled ? "MFA enabled" : "MFA disabled",
      message: enabled
        ? "Multi-factor authentication is now enabled on your account."
        : "Multi-factor authentication was disabled on your account.",
      channel: "IN_APP",
      metadata: {
        source: "profile",
        category: "security",
      },
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope(
        enabled ? "MFA enabled." : "MFA disabled.",
        await loadProfile(principal),
        context.requestId
      ),
    };
  }

  async function revokeSession(
    principal: ProfilePrincipal,
    sessionId: string,
    context: AuthRequestContext
  ) {
    if (!sessionId.trim()) {
      return {
        statusCode: 400,
        body: buildProfileError("sessionId is required.", "VALIDATION_ERROR", context.requestId),
      };
    }

    const sessions = await dependencies.authStore.listActiveSessions(principal.user.id);
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return {
        statusCode: 404,
        body: buildProfileError("Session not found.", "SESSION_NOT_FOUND", context.requestId),
      };
    }

    await dependencies.authStore.revokeSession(sessionId, "Revoked from the profile security center.");

    await logProfileEvent(dependencies.authStore, {
      userId: principal.user.id,
      role: principal.user.role,
      action: PROFILE_AUDIT_ACTIONS.SESSION_REVOKED,
      entityType: "session",
      entityId: sessionId,
      oldValue: {
        isActive: session.isActive,
      },
      newValue: {
        isActive: false,
      },
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      eventType: PROFILE_AUDIT_ACTIONS.SESSION_REVOKED,
      eventDescription: "An active session was revoked from the profile center.",
      riskLevel: "MEDIUM",
    });

    return {
      statusCode: 200,
      body: buildProfileEnvelope("Session revoked.", await loadProfile(principal), context.requestId),
    };
  }

  return {
    async getProfile(principal: ProfilePrincipal, context: AuthRequestContext) {
      await logProfileEvent(dependencies.authStore, {
        userId: principal.user.id,
        role: principal.user.role,
        action: PROFILE_AUDIT_ACTIONS.VIEWED,
        entityType: "profile",
        entityId: principal.user.id,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
      });

      return {
        statusCode: 200,
        body: buildProfileEnvelope("Profile snapshot retrieved.", await loadProfile(principal), context.requestId),
      };
    },
    updateAccount,
    updateNotificationPreferences,
    updatePrivacyPreferences,
    requestPrivacyDataExport,
    requestPrivacyDeletion,
    changePassword,
    setMfaEnabled,
    revokeSession,
    revokeAllSessions,
    rotateRecoveryCodes,
    trustDevice,
    revokeTrustedDevice,
    acknowledgeSecurityAlert,
    getProfileError(message: string, errorCode: string, requestId: string) {
      return buildProfileError(message, errorCode, requestId);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
