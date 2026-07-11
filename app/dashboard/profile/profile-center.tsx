"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell,
  Lock,
  Shield,
  User,
} from "lucide-react";

import {
  acknowledgeProfileSecurityAlert,
  changeProfilePassword,
  disableProfileMfa,
  enableProfileMfa,
  getProfile,
  revokeProfileSession,
  revokeProfileTrustedDevice,
  revokeAllProfileSessions,
  rotateProfileRecoveryCodes,
  requestProfileDataExport,
  requestProfileDeletion,
  trustProfileDevice,
  updateProfileAccount,
  updateProfileNotifications,
  updateProfilePrivacy,
  type ProfileAccountUpdateInput,
  type ProfilePasswordChangeInput,
  type ProfileRecoveryCodeRotationResponse,
  type ProfilePreferencesUpdateInput,
  type ProfilePrivacyUpdateInput,
  type ProfileTrustDeviceInput,
  type ProfileRole,
  type ProfileSectionId,
  type ProfileSnapshot,
} from "@/lib/profile-api";

export type ProfileCenterNavItem = {
  id: ProfileSectionId;
  title: string;
  subtitle: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export const PROFILE_CENTER_NAV_ITEMS: ProfileCenterNavItem[] = [
  {
    id: "account",
    title: "Account",
    subtitle: "Identity, contact and sign-in identity",
    href: "/dashboard/profile/account",
    icon: User,
  },
  {
    id: "security",
    title: "Security",
    subtitle: "Password, MFA and live sessions",
    href: "/dashboard/profile/security",
    icon: Shield,
  },
  {
    id: "notifications",
    title: "Notifications",
    subtitle: "Workflow, security and delivery alerts",
    href: "/dashboard/profile/notifications",
    icon: Bell,
  },
  {
    id: "privacy",
    title: "Privacy",
    subtitle: "Sharing, export and device-tracking controls",
    href: "/dashboard/profile/privacy",
    icon: Lock,
  },
];

type ProfileCenterContextValue = {
  profile: ProfileSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateAccount: (input: ProfileAccountUpdateInput) => Promise<ProfileSnapshot>;
  updateNotifications: (input: ProfilePreferencesUpdateInput) => Promise<ProfileSnapshot>;
  updatePrivacy: (input: ProfilePrivacyUpdateInput) => Promise<ProfileSnapshot>;
  requestPrivacyDataExport: (input?: { reason?: string | null }) => Promise<ProfileSnapshot>;
  requestPrivacyDeletion: (input?: { reason?: string | null }) => Promise<ProfileSnapshot>;
  changePassword: (input: ProfilePasswordChangeInput) => Promise<ProfileSnapshot>;
  setMfaEnabled: (enabled: boolean) => Promise<ProfileSnapshot>;
  revokeSession: (sessionId: string) => Promise<ProfileSnapshot>;
  revokeAllSessions: () => Promise<ProfileSnapshot>;
  rotateRecoveryCodes: () => Promise<ProfileRecoveryCodeRotationResponse>;
  trustDevice: (sessionId: string, input: ProfileTrustDeviceInput) => Promise<ProfileSnapshot>;
  revokeTrustedDevice: (sessionId: string) => Promise<ProfileSnapshot>;
  acknowledgeSecurityAlert: (eventId: string) => Promise<ProfileSnapshot>;
};

const ProfileCenterContext = createContext<ProfileCenterContextValue | null>(null);

export function ProfileCenterProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await getProfile();
      setProfile(payload.profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const applyProfileResponse = useCallback((nextProfile: ProfileSnapshot) => {
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const updateAccount = useCallback(
    async (input: ProfileAccountUpdateInput) => {
      const payload = await updateProfileAccount(input);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const updateNotifications = useCallback(
    async (input: ProfilePreferencesUpdateInput) => {
      const payload = await updateProfileNotifications(input);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const updatePrivacy = useCallback(
    async (input: ProfilePrivacyUpdateInput) => {
      const payload = await updateProfilePrivacy(input);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const requestPrivacyDataExport = useCallback(
    async (input?: { reason?: string | null }) => {
      const payload = await requestProfileDataExport(input ?? {});
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const requestPrivacyDeletion = useCallback(
    async (input?: { reason?: string | null }) => {
      const payload = await requestProfileDeletion(input ?? {});
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const changePassword = useCallback(
    async (input: ProfilePasswordChangeInput) => {
      const payload = await changeProfilePassword(input);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const setMfaEnabled = useCallback(
    async (enabled: boolean) => {
      const payload = enabled ? await enableProfileMfa() : await disableProfileMfa();
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const revokeSession = useCallback(
    async (sessionId: string) => {
      const payload = await revokeProfileSession(sessionId);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const revokeAllSessions = useCallback(
    async () => {
      const payload = await revokeAllProfileSessions();
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const rotateRecoveryCodes = useCallback(async () => {
    const payload = await rotateProfileRecoveryCodes();
    setProfile(payload.profile);
    return payload;
  }, []);

  const trustDevice = useCallback(
    async (sessionId: string, input: ProfileTrustDeviceInput) => {
      const payload = await trustProfileDevice(sessionId, input);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const revokeTrustedDevice = useCallback(
    async (sessionId: string) => {
      const payload = await revokeProfileTrustedDevice(sessionId);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const acknowledgeSecurityAlert = useCallback(
    async (eventId: string) => {
      const payload = await acknowledgeProfileSecurityAlert(eventId);
      return applyProfileResponse(payload.profile);
    },
    [applyProfileResponse]
  );

  const value = useMemo<ProfileCenterContextValue>(
    () => ({
      profile,
      loading,
      error,
      refresh,
      updateAccount,
      updateNotifications,
      updatePrivacy,
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
    }),
    [
      acknowledgeSecurityAlert,
      changePassword,
      error,
      loading,
      profile,
      refresh,
      revokeAllSessions,
      revokeSession,
      revokeTrustedDevice,
      rotateRecoveryCodes,
      setMfaEnabled,
      trustDevice,
      updateAccount,
      updateNotifications,
      updatePrivacy,
      requestPrivacyDataExport,
      requestPrivacyDeletion,
    ]
  );

  return <ProfileCenterContext.Provider value={value}>{children}</ProfileCenterContext.Provider>;
}

export function useProfileCenter() {
  const context = useContext(ProfileCenterContext);

  if (!context) {
    throw new Error("useProfileCenter must be used within a ProfileCenterProvider.");
  }

  return context;
}

export function useProfileSection(sectionId: ProfileSectionId) {
  const context = useProfileCenter();
  const section = context.profile?.sections.find((item) => item.id === sectionId) ?? null;

  return {
    ...context,
    section,
    isVisible: Boolean(section?.visible),
  };
}

export function getVisibleProfileNavItems(profile: ProfileSnapshot | null) {
  if (!profile) {
    return PROFILE_CENTER_NAV_ITEMS;
  }

  const visibleIds = new Set(
    profile.sections.filter((section) => section.visible).map((section) => section.id)
  );

  return PROFILE_CENTER_NAV_ITEMS.filter((item) => visibleIds.has(item.id));
}

export function getProfileRoleLabel(role: ProfileRole) {
  if (role === "CUSTOMER") return "Customer";
  if (role === "NOMINEE") return "Nominee";
  if (role === "VERIFICATION_OFFICER") return "Verification Officer";
  if (role === "ADMIN") return "Admin";
  return "Super Admin";
}
