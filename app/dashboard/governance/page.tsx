"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Clock3, FileCheck, Lock, Shield, ShieldCheck, UserCog, Users } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import {
  getAdminSettings,
  getGovernanceSnapshot,
  type AdminSettingsPayload,
  type GovernanceSnapshot,
} from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

function statusTone(status: GovernanceSnapshot["policies"][number]["status"]) {
  if (status === "active") return "success" as const;
  if (status === "review") return "warning" as const;
  return "destructive" as const;
}

function actionTone(status: GovernanceSnapshot["actions"][number]["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "monitoring") return "warning" as const;
  return "destructive" as const;
}

export default function GovernancePage() {
  const [snapshot, setSnapshot] = useState<GovernanceSnapshot | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [payload, settings] = await Promise.all([getGovernanceSnapshot(), getAdminSettings()]);
        if (active) {
          setSnapshot(payload.dashboard);
          setAdminSettings(settings);
        }
      } catch {
        if (active) {
          setSnapshot(null);
          setAdminSettings(null);
          setError("Unable to load the live governance snapshot right now.");
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

  const policies = snapshot?.policies ?? [];
  const timeline = snapshot?.timeline ?? [];
  const health = snapshot?.health ?? [];
  const adminCount = adminSettings?.admins.length ?? 0;
  const officerCount = adminSettings?.verificationOfficers.length ?? 0;
  const privilegedAccounts = adminCount + officerCount;
  const openSecurityEvents = snapshot?.summary.openSecurityEvents ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Trust & Governance"
          description="Oversight panels for policy review, role boundaries, compliance posture and admin action history."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading governance snapshot...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Trust & Governance"
          description="Oversight panels for policy review, role boundaries, compliance posture and admin action history."
        />
        <Card className="border-[#F2C9C9] bg-[#FFF7F7]">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold text-[#7F1D1D]">Live data unavailable</p>
            <p className="text-sm leading-6 text-[#991B1B]">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Trust & Governance"
        description="Oversight panels for policy review, role boundaries, compliance posture and admin action history. Governance observes the workflow; it does not bypass it."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings#admin-accounts">
                <UserCog className="h-4 w-4" />
                Create admin
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings#verification-officers">
                <Users className="h-4 w-4" />
                Create officer
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/officers">
                <ArrowRight className="h-4 w-4" />
                Manage officers
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-[#BBD4FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#FFFFFF_100%)]">
        <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Super admin control center</p>
            <h2 className="text-2xl font-semibold text-[#0F172A]">Create and manage the platform roles that actually run the system.</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              The governance page now points straight at the admin and verification-officer workflows so you can create accounts, review role state, and jump into RBAC without hunting through passive dashboards.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild>
                <Link href="/dashboard/settings#admin-accounts">
                  <UserCog className="h-4 w-4" />
                  Go to admin creation
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/settings#verification-officers">
                  <Users className="h-4 w-4" />
                  Go to officer creation
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/rbac">
                  <ShieldCheck className="h-4 w-4" />
                  Review RBAC
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              { label: "Admin accounts", value: adminCount, hint: "Owner and super-admin control" },
              { label: "Verification officers", value: officerCount, hint: "Invite-only review roles" },
              { label: "Privileged users", value: privilegedAccounts, hint: "Admin + officer total" },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Create admin",
            value: adminCount,
            icon: UserCog,
            hint: "Launch a privileged admin account from settings.",
            href: "/dashboard/settings#admin-accounts",
            cta: "Open admin creation",
          },
          {
            label: "Create officer",
            value: officerCount,
            icon: Users,
            hint: "Provision a verification officer with invite-only access.",
            href: "/dashboard/settings#create-verification-officer",
            cta: "Open officer creation",
          },
          {
            label: "Manage RBAC",
            value: privilegedAccounts,
            icon: ShieldCheck,
            hint: "Review permissions and role boundaries.",
            href: "/dashboard/rbac",
            cta: "Open RBAC",
          },
          {
            label: "Security review",
            value: openSecurityEvents,
            icon: AlertTriangle,
            hint: "Inspect open security events and incident posture.",
            href: "/dashboard/security",
            cta: "Open security center",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BBD4FF] hover:shadow-[0_12px_36px_rgba(22,59,140,0.08)]">
              <CardContent className="flex h-full flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{item.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.hint}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C] transition-transform group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link href={item.href}>
                    <span>{item.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {loading ? (
        <Card>
          <CardContent className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
            Loading governance snapshot...
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {health.map((item) => (
                <div key={item.label} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                    <Badge variant={item.status === "healthy" ? "success" : item.status === "degraded" ? "warning" : "secondary"}>
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Policy overview</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    The governance snapshot is compiled from live ledger counts, readiness checks and role mappings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Read model</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">Backend-backed oversight</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Role boundaries stay explicit, and every state change in this layer remains auditable.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Retention</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">7 years audit / 12 months notifications</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Retention values are aligned to the compliance documentation and surfaced from the live snapshot.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Policy overview"
              description="State changes are visible as active, review or restricted so the admin team can spot drift quickly."
            />

            <div className="grid gap-4 lg:grid-cols-3">
              {policies.map((policy) => (
                <div key={policy.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                      <Shield className="h-5 w-5" />
                    </div>
                    <Badge variant={statusTone(policy.status)}>{policy.status}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#0F172A]">{policy.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{policy.summary}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{policy.owner}</span>
                    <span>{formatDateTime(policy.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <SectionHeader
                title="Permission matrix"
                description="A quick preview of how the control plane is scoped."
              />

              <div className="space-y-3">
                {(snapshot?.permissionMatrix ?? []).map((row) => (
                  <div key={row.role} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{row.role}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{row.note}</p>
                      </div>
                      <Badge variant="secondary">{row.permissions.length} perms</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <SectionHeader
                title="Admin action timeline"
                description="Policy reviews and operational interventions remain visible for oversight."
              />

              <div className="space-y-3">
                {timeline.map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                          <FileCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#0F172A]">{item.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</p>
                        </div>
                      </div>
                      <Badge variant={actionTone(item.outcome === "success" ? "completed" : "monitoring")}>
                        {item.outcome}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{item.actor}</span>
                      <span>{formatDateTime(item.occurredAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">Governance guardrail</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Changes to security defaults and backup policy should be treated as critical and always audited.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
