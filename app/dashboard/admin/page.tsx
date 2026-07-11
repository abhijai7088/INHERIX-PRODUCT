"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Bell, CheckCircle2, Download, ShieldAlert, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { downloadAuditLogsExport, getAdminDashboard, type AdminDashboardPayload } from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

function priorityTone(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized.includes("critical") || normalized.includes("high")) return "destructive" as const;
  if (normalized.includes("medium")) return "warning" as const;
  return "secondary" as const;
}

function healthTone(status: AdminDashboardPayload["health"][number]["status"]) {
  if (status === "healthy") return "success" as const;
  if (status === "degraded") return "warning" as const;
  return "secondary" as const;
}

function eventTone(event: AdminDashboardPayload["recentAdminEvents"][number]) {
  if (event.severity === "high" || event.outcome === "failure") return "destructive" as const;
  if (event.severity === "medium" || event.outcome === "warning") return "warning" as const;
  return "success" as const;
}

function ExpandableList<T>({
  items,
  renderItem,
  emptyMessage,
  maxVisible = 3,
  containerClassName = "space-y-3",
  emptyClassName = "rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-slate-500",
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage: string;
  maxVisible?: number;
  containerClassName?: string;
  emptyClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) {
    return <div className={emptyClassName}>{emptyMessage}</div>;
  }

  const visibleItems = expanded ? items : items.slice(0, maxVisible);

  return (
    <div className={containerClassName}>
      {visibleItems.map(renderItem)}
      {items.length > maxVisible && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-[#163B8C] hover:bg-[#F8FBFF]"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `View all ${items.length}`}
        </Button>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<AdminDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAdminDashboard();
        if (active) {
          setSnapshot(payload);
        }
      } catch {
        if (active) {
          setSnapshot(null);
          setError("Unable to load the live admin snapshot right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function handleExportSummary() {
    setDownloading(true);
    try {
      const csv = await downloadAuditLogsExport();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "inherix-admin-summary.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const summary = snapshot?.summary;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Admin Dashboard"
          description="The live operator control plane for trigger review, release oversight and security alerts."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading live admin data...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Admin Dashboard"
          description="The live operator control plane for trigger review, release oversight and security alerts."
        />
        <Card className="border-[#F2C9C9] bg-[#FFF7F7]">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold text-[#7F1D1D]">Live data unavailable</p>
            <p className="text-sm leading-6 text-[#991B1B]">{error}</p>
            <p className="text-sm leading-6 text-[#991B1B]">
              The admin surface is wired to the backend, so no placeholder numbers are shown when the snapshot cannot be fetched.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Admin Dashboard"
        description="The live operator control plane for trigger review, release oversight and security alerts. It surfaces the current queue without exposing vault contents."
        actions={
          <Button variant="outline" size="sm" onClick={() => void handleExportSummary()} disabled={downloading || loading}>
            <Download className="h-4 w-4" />
            {downloading ? "Preparing export..." : "Export audit summary"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pending triggers", value: summary?.pendingTriggers ?? 0, detail: "Awaiting admin review", icon: Bell },
          { label: "Approved triggers", value: summary?.approvedTriggers ?? 0, detail: "Ready for controlled release", icon: CheckCircle2 },
          { label: "Rejected triggers", value: summary?.rejectedTriggers ?? 0, detail: "Closed with an audit trail", icon: ShieldAlert },
          { label: "Recent releases", value: summary?.recentReleases ?? 0, detail: "Live release records in view", icon: ShieldCheck },
          { label: "Security alerts", value: summary?.securityAlerts ?? 0, detail: "Open device and session alerts", icon: ShieldAlert },
          { label: "Active sessions", value: summary?.activeSessions ?? 0, detail: "Currently active sessions", icon: Users },
          { label: "Unread notifications", value: summary?.unreadNotifications ?? 0, detail: "Pending admin visibility", icon: Bell },
          { label: "Readiness", value: snapshot?.readiness.status === "ready" ? "Ready" : "Attention", detail: snapshot?.readiness.status === "ready" ? "Core secrets are configured" : "Missing production secrets", icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label}>
              <CardContent className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-[#DCE3EC] bg-white">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Workflow shortcuts</p>
            <p className="text-sm leading-6 text-slate-600">
              Jump straight into the trigger queue, verification desk, release center, or audit reports without leaving the console.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/emergency/verification">Open verification queue</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/releases">Open release center</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Open reports</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <SectionHeader
              title="System health"
              description="The admin dashboard reads directly from live readiness checks and current queue pressure."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {(snapshot?.health ?? []).map((item) => (
                <div key={item.label} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                    <Badge variant={healthTone(item.status)}>{item.status}</Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Control plane note</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    This view is read-only by design. Triggers, releases and security events stay auditable even when operators are only reviewing live state.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Alerts</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">Action required items</p>
              <ExpandableList
                items={snapshot?.alerts ?? []}
                emptyMessage="No active operational alerts."
                containerClassName="mt-4 space-y-2"
                emptyClassName="rounded-2xl border border-[#EEF2F7] bg-[#FAFCFF] px-4 py-3 text-sm leading-6 text-slate-600"
                renderItem={(alert) => (
                  <div key={alert} className="rounded-2xl border border-[#EEF2F7] bg-[#FAFCFF] px-4 py-3 text-sm leading-6 text-slate-600">
                    {alert}
                  </div>
                )}
              />
            </div>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Readiness</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">Production posture</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Database", value: snapshot?.readiness.databaseConfigured ? "Configured" : "Missing" },
                  { label: "Storage", value: snapshot?.readiness.storageConfigured ? "Configured" : "Missing" },
                  { label: "Notifications", value: snapshot?.readiness.notificationsConfigured ? "Configured" : "Missing" },
                  {
                    label: "Secrets",
                    value: snapshot?.readiness.missingProductionSecrets?.length
                      ? `${snapshot.readiness.missingProductionSecrets.length} missing`
                      : "Ready",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#EEF2F7] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm font-medium text-[#0F172A]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Pending trigger queue"
              description="These requests were pulled directly from the live trigger ledger."
            />

            <ExpandableList
              items={snapshot?.pendingTriggers ?? []}
              emptyMessage="No pending trigger requests are currently queued."
              containerClassName="space-y-4"
              emptyClassName="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-sm text-slate-500"
              renderItem={(item) => (
                <div key={item.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#0F172A]">{item.subjectLine}</h3>
                        <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                        <Badge variant="secondary">{item.requestKind}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-500">
                        Nominee {item.nomineeName} - Customer {item.customerId}
                      </p>
                      <p className="text-sm leading-6 text-slate-500">Last activity {formatDateTime(item.latestActivityAt)}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              )}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <SectionHeader title="Recent releases" description="Controlled release records surfaced from the release ledger." />

              <ExpandableList
                items={snapshot?.recentReleases ?? []}
                emptyMessage="No release records are available yet."
                renderItem={(item) => (
                  <div key={item.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{item.documentTitle}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {item.nomineeName} - {item.categoryName}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Released by {item.releasedBy ?? "System"} - {item.releasedAt ? formatDateTime(item.releasedAt) : "Pending"}
                        </p>
                      </div>
                      <Badge variant={item.releaseStatus === "RELEASED" ? "success" : item.releaseStatus === "REVOKED" ? "destructive" : "warning"}>
                        {item.releaseStatus}
                      </Badge>
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <SectionHeader title="Security alerts" description="Open security and session alerts pulled from the live observability stream." />

              <ExpandableList
                items={snapshot?.securityAlerts ?? []}
                emptyMessage="No active security alerts are surfaced."
                renderItem={(item) => (
                  <div key={item.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</p>
                        <p className="mt-2 text-xs text-slate-500">{item.actor} - {formatDateTime(item.occurredAt)}</p>
                      </div>
                      <Badge variant={eventTone(item)}>{item.severity}</Badge>
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader title="Recent admin events" description="The latest audited events from the control plane." />

            <ExpandableList
              items={snapshot?.recentAdminEvents ?? []}
              emptyMessage="No admin events are available yet."
              renderItem={(item) => (
                <div key={item.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A]">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</p>
                      <p className="mt-2 text-xs text-slate-500">{item.actor} - {formatDateTime(item.occurredAt)}</p>
                    </div>
                    <Badge variant={eventTone(item)}>{item.domain}</Badge>
                  </div>
                </div>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <SectionHeader title="Operational access" description="Links to the remaining control surfaces and governance read models." />

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
                { label: "Settings", href: "/dashboard/settings", icon: ShieldCheck },
                { label: "Backup", href: "/dashboard/backup", icon: Download },
                { label: "Governance", href: "/dashboard/governance", icon: ShieldAlert },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4 transition hover:border-[#CBD5E1] hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-[#0F172A]">{item.label}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Open the live {item.label.toLowerCase()} workspace.</p>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
