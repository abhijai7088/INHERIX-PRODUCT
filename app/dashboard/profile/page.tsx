"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  Info,
  LifeBuoy,
  LogOut,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { formatDateTime } from "@/lib/records";

import { getVisibleProfileNavItems } from "./profile-center";
import { useProfile } from "@/hooks/use-profile";

export default function ProfileHubPage() {
  const { profile, account, loading, refresh } = useProfile();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const visibleNavItems = getVisibleProfileNavItems(profile);

  const recentNotifications = profile?.notifications?.recentNotifications ?? [];
  const recentEvents = profile?.security?.recentSecurityEvents ?? [];

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile Center"
        description="A live profile workspace for identity, security, delivery and privacy controls. The surface is backed by the profile aggregate and every sensitive action is audited."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <Clock3 className="h-4 w-4" />
              Refresh profile
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-[#E5ECF5] bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Visible sections</p>
            <p className="text-3xl font-semibold text-[#0F172A]">{profile?.sections?.filter((section) => section.visible).length ?? 0}</p>
            <p className="text-sm leading-6 text-slate-500">Sections exposed to the current role.</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5ECF5] bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Active sessions</p>
            <p className="text-3xl font-semibold text-[#0F172A]">{profile?.security?.activeSessionCount ?? 0}</p>
            <p className="text-sm leading-6 text-slate-500">Live browser and device sessions.</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5ECF5] bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Unread notifications</p>
            <p className="text-3xl font-semibold text-[#0F172A]">{profile?.notifications?.unreadCount ?? 0}</p>
            <p className="text-sm leading-6 text-slate-500">Workflow, security and delivery updates.</p>
          </CardContent>
        </Card>

        <Card className="border-[#E5ECF5] bg-white">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Role</p>
            <p className="text-2xl font-semibold text-[#0F172A]">{account?.role ?? "Loading"}</p>
            <p className="text-sm leading-6 text-slate-500">Role-scoped access and controls.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <SectionHeader
              title="Profile sections"
              description="Only sections visible to the current role are exposed. No dead links, no hidden placeholders."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {loading ? (
                <div className="col-span-full rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                  Loading profile center...
                </div>
              ) : visibleNavItems.length ? (
                visibleNavItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group rounded-[26px] border border-[#E5ECF5] bg-white p-5 transition-all duration-200 hover:border-[#163B8C] hover:bg-[#F8FBFF]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C] transition group-hover:bg-[#163B8C] group-hover:text-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#163B8C]" />
                      </div>

                      <h3 className="mt-4 text-base font-semibold text-[#0F172A]">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.subtitle}</p>
                    </Link>
                  );
                })
              ) : (
                <Notice title="No profile sections available">
                  The current role does not expose any profile sections in this environment.
                </Notice>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Account snapshot"
                  description="Real data from the profile aggregate."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Name</p>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.fullName ?? "Loading..."}</p>
                  </div>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Email</p>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.email ?? "Loading..."}</p>
                  </div>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Last login</p>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Not available"}</p>
                  </div>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">MFA</p>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">{account?.mfaEnabled ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {profile?.security?.mfaEnabled ? <Badge variant="success">MFA enabled</Badge> : <Badge variant="warning">MFA disabled</Badge>}
                  <Badge variant={account?.status === "ACTIVE" ? "success" : "secondary"}>{account?.status ?? "Loading"}</Badge>
                  <Badge variant="default">{account ? account.role : "Loading"}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Latest activity"
                  description="The most recent notifications and security events available to this role."
                />

                <div className="space-y-3">
                  {recentNotifications.length ? (
                    recentNotifications.slice(0, 3).map((notification) => (
                      <div key={notification.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-[#0F172A]">{notification.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{notification.message}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {typeof notification.metadata?.actionPath === "string" ? (
                                <Button asChild size="sm" variant="outline">
                                  <Link href={notification.metadata.actionPath}>
                                    {typeof notification.metadata?.actionLabel === "string" ? notification.metadata.actionLabel : "Open workflow"}
                                  </Link>
                                </Button>
                              ) : null}
                              {typeof notification.metadata?.invitationUrl === "string" ? (
                                <Button asChild size="sm" variant="outline">
                                  <Link href={notification.metadata.invitationUrl}>Open invitation link</Link>
                                </Button>
                              ) : null}
                            </div>
                            {typeof notification.metadata?.invitationUrl === "string" ? (
                              <div className="mt-2 rounded-xl border border-[#DCE3EC] bg-[#F8FAFC] p-3 text-xs leading-5 text-slate-600">
                                <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">Invitation link</p>
                                <Link
                                  href={notification.metadata.invitationUrl}
                                  className="mt-1 block break-all font-medium text-[#163B8B] underline decoration-[#A7B8E8] underline-offset-4"
                                >
                                  {notification.metadata.invitationUrl}
                                </Link>
                              </div>
                            ) : null}
                          </div>
                          <span className="text-xs text-slate-400">{formatDateTime(notification.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Notice title="No notifications yet">
                      Notification activity will appear here once workflow, release or security events occur.
                    </Notice>
                  )}

                  {recentEvents.length ? (
                    recentEvents.slice(0, 2).map((event) => (
                      <div key={event.id} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-[#0F172A]">{event.eventType}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{event.eventDescription ?? "Recorded security activity."}</p>
                          </div>
                          <span className="text-xs text-slate-400">{formatDateTime(event.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Help and platform"
                  description="Real destinations for support guidance and product information."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/dashboard/profile/support"
                    className="group flex items-center justify-between rounded-[24px] border border-[#E5ECF5] bg-white p-4 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C] transition group-hover:bg-[#163B8C] group-hover:text-white">
                        <LifeBuoy className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">Support</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Readiness and escalation metadata.</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#163B8C]" />
                  </Link>

                  <Link
                    href="/dashboard/profile/about"
                    className="group flex items-center justify-between rounded-[24px] border border-[#E5ECF5] bg-white p-4 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C] transition group-hover:bg-[#163B8C] group-hover:text-white">
                        <Info className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">About</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Version and runtime metadata.</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#163B8C]" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
