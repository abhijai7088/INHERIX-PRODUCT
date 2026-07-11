"use client";

import { useMemo } from "react";

import { useProfileCenter } from "@/app/dashboard/profile/profile-center";
import type {
  ProfileAccountUpdateInput,
  ProfilePasswordChangeInput,
  ProfilePrivacyUpdateInput,
  ProfileSectionId,
  ProfileSnapshot,
} from "@/types/profile";

export function useProfile() {
  const context = useProfileCenter();
  const profile = context.profile;

  const sectionsById = useMemo(() => {
    const map = new Map<ProfileSectionId, ProfileSnapshot["sections"][number]>();
    profile?.sections.forEach((section) => {
      map.set(section.id, section);
    });
    return map;
  }, [profile]);

  return {
    profile,
    account: profile?.account ?? null,
    notifications: profile?.notifications ?? null,
    privacy: profile?.privacy ?? null,
    security: profile?.security ?? null,
    hardening: profile?.hardening ?? null,
    role: profile?.role ?? null,
    sections: profile?.sections ?? [],
    effectivePermissions: profile?.effectivePermissions ?? [],
    loading: context.loading,
    error: context.error,
    refresh: context.refresh,
    updateAccount: context.updateAccount,
    updateNotifications: context.updateNotifications,
    updatePrivacy: context.updatePrivacy,
    requestPrivacyDataExport: context.requestPrivacyDataExport,
    requestPrivacyDeletion: context.requestPrivacyDeletion,
    changePassword: context.changePassword,
    setMfaEnabled: context.setMfaEnabled,
    revokeSession: context.revokeSession,
    revokeAllSessions: context.revokeAllSessions,
    rotateRecoveryCodes: context.rotateRecoveryCodes,
    trustDevice: context.trustDevice,
    revokeTrustedDevice: context.revokeTrustedDevice,
    acknowledgeSecurityAlert: context.acknowledgeSecurityAlert,
    isSectionVisible(sectionId: ProfileSectionId) {
      return Boolean(sectionsById.get(sectionId)?.visible);
    },
    getSection(sectionId: ProfileSectionId) {
      return sectionsById.get(sectionId) ?? null;
    },
  };
}

export type UseProfileResult = ReturnType<typeof useProfile>;
export type { ProfileAccountUpdateInput, ProfilePasswordChangeInput, ProfilePrivacyUpdateInput };
