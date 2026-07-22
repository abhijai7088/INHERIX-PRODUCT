"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CircleAlert,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Notice } from "@/components/inherix/notice";
import { Separator } from "@/components/inherix/separator";
import { getAccountLabel, getInitials } from "@/lib/account";
import { formatDateTime } from "@/lib/records";

import {
  getVisibleProfileNavItems,
  ProfileCenterProvider,
  useProfileCenter,
  type ProfileCenterNavItem,
} from "./profile-center";

function ProfileNavLink({
  item,
  pathname,
}: {
  item: ProfileCenterNavItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-4 rounded-[24px] border px-4 py-4 transition-all duration-200 ${
        active
          ? "border-[#163B8C] bg-[#EEF4FF] shadow-sm"
          : "border-[#E5ECF5] bg-white hover:border-[#163B8C] hover:bg-[#F8FBFF]"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
          active ? "bg-[#163B8C] text-white" : "bg-[#EEF4FF] text-[#163B8C]"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-[15px] font-semibold text-[#0F172A]">{item.title}</h3>
          <span className={`text-xs font-medium ${active ? "text-[#163B8C]" : "text-slate-400"}`}>
            Open
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">{item.subtitle}</p>
      </div>
    </Link>
  );
}

function ProfileShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, error, refresh } = useProfileCenter();
  const [signingOut, setSigningOut] = useState(false);

  const visibleNavItems = getVisibleProfileNavItems(profile);
  const account = profile?.account ?? null;

  async function handleSignOut() {
    const confirmed = window.confirm("Sign out of this browser session?");
    if (!confirmed) {
      return;
    }

    setSigningOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } finally {
      window.location.assign("/onboarding/login");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[368px_minmax(0,1fr)]">
        <aside className="space-y-6 xl:sticky xl:top-8">
          <Card className="overflow-hidden border-[#DCE3EC] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
            <div className="h-28 bg-[linear-gradient(135deg,#163B8C_0%,#2956B4_56%,#4C7CF0_100%)]" />
            <CardContent className="space-y-6 pt-0">
              <div className="-mt-10 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[26px] border-[6px] border-white bg-[#EEF4FF] text-[26px] font-semibold text-[#163B8C] shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                  {account ? account.initials : "IN"}
                </div>
              </div>

              <div className="space-y-2 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#163B8C]">Profile center</p>
                <h1 className="text-[24px] font-semibold tracking-tight text-[#0F172A]">
                  {account?.fullName ?? "Signed-in account"}
                </h1>
                <p className="text-sm text-slate-500">{account?.email ?? "Loading profile..."}</p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="default">{account ? getAccountLabel(account.role) : "Loading role"}</Badge>
                {account?.mfaEnabled ? <Badge variant="success">MFA on</Badge> : <Badge variant="warning">MFA off</Badge>}
                {account?.status ? <Badge variant={account.status === "ACTIVE" ? "success" : "secondary"}>{account.status}</Badge> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Visible sections</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{profile?.sections?.filter((section) => section.visible).length ?? 0}</p>
                </div>

                <div className="rounded-[20px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Active sessions</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{profile?.security?.activeSessionCount ?? 0}</p>
                </div>

                <div className="rounded-[20px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Last login</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Not available"}</p>
                </div>

                <div className="rounded-[20px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Reviewed</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{profile?.privacy?.lastReviewedAt ? formatDateTime(profile.privacy.lastReviewedAt) : "Not available"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#163B8C]">Sections</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Account settings</h2>
                </div>

                <Button variant="outline" size="sm" onClick={() => void refresh()}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                    Loading profile sections...
                  </div>
                ) : visibleNavItems.length ? (
                  visibleNavItems.map((item) => (
                    <ProfileNavLink key={item.id} item={item} pathname={pathname} />
                  ))
                ) : (
                  <Notice title="No sections available">
                    The current role does not expose any profile sections in this environment.
                  </Notice>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#163B8C]">Audit posture</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Every change is logged</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-500">
                Sensitive profile mutations create audit records and security events before the UI confirms success.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <p className="text-xs text-slate-500">Account ID</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A]">{account?.id.slice(0, 12) ?? "Loading..."}</p>
                </div>
                <div className="rounded-[20px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <p className="text-xs text-slate-500">Role</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A]">{account ? getAccountLabel(account.role) : "Loading..."}</p>
                </div>
              </div>
              {error ? (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                <span>Profile changes are written to the audit trail immediately.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#DCE3EC] bg-white">
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#163B8C]">Session controls</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Sign out when you finish</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <LogOut className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-500">
                End the current browser session and clear the authenticated profile surface before you leave the workstation.
              </p>
              <button
                type="button"
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[16px] bg-white border border-[#DCE3EC] px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:border-red-200 hover:shadow-[0_8px_20px_rgba(239,68,68,0.12)] disabled:opacity-50"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-50 to-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <LogOut className="relative z-10 h-4 w-4 text-slate-400 transition-colors duration-300 group-hover:text-red-500" />
                <span className="relative z-10 transition-colors duration-300 group-hover:text-red-600">
                  {signingOut ? "Signing out securely..." : "Sign out securely"}
                </span>
              </button>
            </CardContent>
          </Card>

          <div className="rounded-[28px] border border-[#DCE3EC] bg-[#F8FBFF] p-4 text-xs leading-6 text-slate-500">
            <div className="flex items-start gap-3">
              <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#163B8C]" />
              <p>
                The profile center is role-scoped. Sections that are not visible for the current role are omitted from navigation and remain unavailable by direct route.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileCenterProvider>
      <ProfileShellContent>{children}</ProfileShellContent>
    </ProfileCenterProvider>
  );
}
