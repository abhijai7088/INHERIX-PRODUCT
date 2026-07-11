"use client";

import { useCallback, useEffect, useState } from "react";

import { getPlatformSnapshot, type PlatformSnapshot } from "@/lib/platform-api";

export function usePlatform() {
  const [platform, setPlatform] = useState<PlatformSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlatform = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const snapshot = await getPlatformSnapshot();
      setPlatform(snapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load platform metadata.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlatform();
  }, [loadPlatform]);

  return {
    platform,
    meta: platform?.meta ?? null,
    readiness: platform?.readiness ?? null,
    loading,
    error,
    refresh: loadPlatform,
  };
}
