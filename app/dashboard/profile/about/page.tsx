"use client";

import Link from "next/link";
import { ArrowRight, Building2, Code2, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { usePlatform } from "@/hooks/use-platform";

export default function ProfileAboutPage() {
  const { meta, readiness, loading, error, refresh } = usePlatform();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="About"
        description="Live platform information for the backend-driven profile experience."
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
              title="Platform identity"
              description="These details come directly from the backend runtime metadata endpoint."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Product name</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.name ?? "Loading..."}</p>
              </div>
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Version</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.version ?? "Loading..."}</p>
              </div>
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Runtime</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.nodeVersion ?? "Loading..."}</p>
              </div>
              <div className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Environment</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.environment ?? "Loading..."}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={readiness?.status === "ready" ? "success" : "warning"}>
                {readiness?.status ? readiness.status : "Loading"}
              </Badge>
              <Badge variant={readiness?.databaseConfigured ? "success" : "destructive"}>
                Database
              </Badge>
              <Badge variant={readiness?.authConfigured ? "success" : "destructive"}>
                Auth
              </Badge>
              <Badge variant={readiness?.notificationsConfigured ? "success" : "warning"}>
                Notifications
              </Badge>
            </div>

            <div className="space-y-3">
              {[
                "The profile surface is backed by live backend data and request workflows.",
                "Privacy mutations, security actions and notification preferences all write audit records.",
                "Role boundaries stay explicit in both the backend and the UI navigation.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#163B8C]" />
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
                title="Runtime details"
                description="Operational information for support and platform verification."
              />

              <div className="grid gap-3">
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">API prefix</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{meta?.apiPrefix ?? "Loading..."}</p>
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Platform notes"
                description="A quick summary of what this screen is and is not."
              />

              <div className="space-y-3">
                {[
                  {
                    icon: Building2,
                    title: "Product surface",
                    body: "This page is part of the premium desktop settings experience, not a standalone marketing site.",
                  },
                  {
                    icon: Code2,
                    title: "Source of truth",
                    body: "Version and environment details come from the backend runtime metadata endpoint.",
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

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/profile/support">
                <ArrowRight className="h-4 w-4" />
                Support
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
