"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getRouteAccessDecision, getDashboardRoleLandingPath } from "@/lib/route-access";
import { getCurrentUser } from "@/lib/trigger-api";

type SessionState =
  | { status: "loading"; message: string }
  | { status: "ready" };

export default function DashboardRouteGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionState, setSessionState] = useState<SessionState>({ status: "loading", message: "Checking access..." });

  const loadingMessage = sessionState.status === "loading" ? sessionState.message : null;

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        if (me.user.mustResetPassword) {
          router.replace("/onboarding/force-reset-password");
          return;
        }

        const decision = getRouteAccessDecision(
          {
            data: {
              user: me.user,
              permissions: me.permissions ?? [],
              nextPath: me.nextPath,
            },
          },
          pathname
        );

        if (!decision.allow) {
          router.replace(decision.redirectTo ?? getDashboardRoleLandingPath({ data: { user: me.user, permissions: me.permissions ?? [] } }));
          return;
        }

        if (pathname === "/dashboard" && me.nextPath && me.nextPath !== "/dashboard") {
          router.replace(me.nextPath);
          return;
        }

        if (active) {
          setSessionState({ status: "ready" });
        }
      } catch {
        if (!active) {
          return;
        }

        router.replace("/onboarding/login");
      }
    };

    setSessionState({ status: "loading", message: "Checking access..." });
    void load();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (sessionState.status !== "ready") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
        <div className="rounded-[28px] border border-[#DCE3EC] bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
          {loadingMessage ?? "Checking access..."}
        </div>
      </div>
    );
  }

  return children;
}
