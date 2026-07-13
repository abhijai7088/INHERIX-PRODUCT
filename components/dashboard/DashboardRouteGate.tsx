"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getRouteAccessDecision, getDashboardRoleLandingPath } from "@/lib/route-access";
import { getCurrentUser } from "@/lib/trigger-api";

export default function DashboardRouteGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionData, setSessionData] = useState<Awaited<ReturnType<typeof getCurrentUser>> | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        if (!active) {
          return;
        }

        if (me.user.mustResetPassword) {
          router.replace("/onboarding/force-reset-password");
          return;
        }

        setSessionData(me);
      } catch {
        if (active) {
          router.replace("/onboarding/login");
        }
      } finally {
        if (active) {
          setInitialLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (initialLoading || !sessionData) {
      return;
    }

    const decision = getRouteAccessDecision(
      {
        data: {
          user: sessionData.user,
          permissions: sessionData.permissions ?? [],
          nextPath: sessionData.nextPath,
        },
      },
      pathname
    );

    if (!decision.allow) {
      router.replace(
        decision.redirectTo ??
          getDashboardRoleLandingPath({
            data: { user: sessionData.user, permissions: sessionData.permissions ?? [] },
          })
      );
      return;
    }

    if (pathname === "/dashboard" && sessionData.nextPath && sessionData.nextPath !== "/dashboard") {
      router.replace(sessionData.nextPath);
      return;
    }
  }, [pathname, router, initialLoading, sessionData]);

  if (initialLoading || !sessionData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
        <div className="rounded-[28px] border border-[#DCE3EC] bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
          Checking access...
        </div>
      </div>
    );
  }

  return children;
}
