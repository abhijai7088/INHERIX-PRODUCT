"use client";

import { useProfile } from "./use-profile";

export function useSecurity() {
  const profile = useProfile();

  return {
    security: profile.security,
    account: profile.account,
    privacy: profile.privacy,
    hardening: profile.hardening,
    role: profile.role,
    loading: profile.loading,
    error: profile.error,
    refresh: profile.refresh,
    changePassword: profile.changePassword,
    setMfaEnabled: profile.setMfaEnabled,
    revokeSession: profile.revokeSession,
    revokeAllSessions: profile.revokeAllSessions,
    rotateRecoveryCodes: profile.rotateRecoveryCodes,
    trustDevice: profile.trustDevice,
    revokeTrustedDevice: profile.revokeTrustedDevice,
    acknowledgeSecurityAlert: profile.acknowledgeSecurityAlert,
    isSectionVisible: profile.isSectionVisible,
    getSection: profile.getSection,
  };
}

export type UseSecurityResult = ReturnType<typeof useSecurity>;
