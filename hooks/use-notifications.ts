"use client";

import { useProfile } from "./use-profile";

export function useNotifications() {
  const profile = useProfile();

  return {
    notifications: profile.notifications,
    loading: profile.loading,
    error: profile.error,
    refresh: profile.refresh,
    updateNotifications: profile.updateNotifications,
    isSectionVisible: profile.isSectionVisible,
    getSection: profile.getSection,
  };
}

export type UseNotificationsResult = ReturnType<typeof useNotifications>;
