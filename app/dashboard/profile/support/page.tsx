"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, BadgeInfo, CheckCircle2, RefreshCw, Shield } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { formatDateTime } from "@/lib/records";
import { usePlatform } from "@/hooks/use-platform";

function readinessLabel(value: boolean) {
  return value ? "Ready" : "Not ready";
}

export default function ProfileSupportPage() {
  const { meta, readiness, loading, error, refresh } = usePlatform();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Support"
        description="Live backend readiness, version data and practical guidance for support escalation."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error ? (
        <Notice title="Unable to load platform metadata" className="border-amber-200 bg-amber-50 text-amber-800">
          {error}
        </Notice>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardContent className="space-y-4">
            <SectionHeader
              title="Platform status"
              description="These values come from the backend readiness and runtime metadata endpoints."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Version</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.version ?? "Loading..."}</p>
              </div>
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Environment</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.environment ?? "Loading..."}</p>
              </div>
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">API prefix</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.apiPrefix ?? "Loading..."}</p>
              </div>
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Backend status</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{readiness?.status ?? "Loading..."}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={readiness?.databaseConfigured ? "success" : "destructive"}>
                Database {readiness ? readinessLabel(readiness.databaseConfigured) : "Loading"}
              </Badge>
              <Badge variant={readiness?.signingConfigured ? "success" : "destructive"}>
                Signing {readiness ? readinessLabel(readiness.signingConfigured) : "Loading"}
              </Badge>
              <Badge variant={readiness?.notificationsConfigured ? "success" : "warning"}>
                Notifications {readiness ? readinessLabel(readiness.notificationsConfigured) : "Loading"}
              </Badge>
              <Badge variant={readiness?.authConfigured ? "success" : "destructive"}>
                Auth {readiness ? readinessLabel(readiness.authConfigured) : "Loading"}
              </Badge>
            </div>

            <div className="space-y-3">
              {[
                "Use this page when a profile action reports a backend or deployment issue.",
                "If readiness is not healthy, the platform operator should verify the listed missing secrets or services.",
                "Profile exports, deletion requests and security actions already write audit records before the UI confirms success.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#163B8C]" />
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Escalation guide"
                description="A concise, real support path without fake contact placeholders."
              />

              <div className="space-y-3">
                {[
                  {
                    icon: CheckCircle2,
                    title: "Confirm the page state",
                    body: "Reload once to rule out a transient session issue and verify the current role still has access.",
                  },
                  {
                    icon: BadgeInfo,
                    title: "Capture live metadata",
                    body: "Copy the environment, version, API prefix and readiness state from this page for the support ticket.",
                  },
                  {
                    icon: AlertCircle,
                    title: "Check the workflow",
                    body: "If a privacy, security or account mutation failed, the audit log already contains the backend action and result.",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Live runtime"
                description="Useful operational metadata surfaced by the backend."
              />

              <div className="grid gap-3">
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Backend name</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.name ?? "Loading..."}</p>
                </div>
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Node runtime</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.nodeVersion ?? "Loading..."}</p>
                </div>
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Body limit</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.bodyLimit ?? "Loading..."}</p>
                </div>
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Frontend origin</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.frontendOrigin ?? "Not configured"}</p>
                </div>
              </div>

              {loading ? (
                <p className="text-sm text-slate-500">Loading live platform metadata...</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/profile/about">
                <ArrowRight className="h-4 w-4" />
                About platform
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/profile">
                <ArrowRight className="h-4 w-4" />
                Back to profile
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
