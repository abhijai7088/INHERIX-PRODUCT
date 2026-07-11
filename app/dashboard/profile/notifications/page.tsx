"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, CheckCheck, Mail, RefreshCw, ShieldAlert, Smartphone } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Checkbox } from "@/components/inherix/checkbox";
import { FieldHint, FieldLabel, FormField } from "@/components/inherix/field";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { formatDateTime } from "@/lib/records";
import type { ProfileNotificationPreferences } from "@/types/profile";

import { useNotifications } from "@/hooks/use-notifications";

type PreferenceKey = keyof ProfileNotificationPreferences;

export default function NotificationProfilePage() {
  const { notifications, loading, error, updateNotifications, refresh, isSectionVisible, getSection } = useNotifications();
  const preferences = notifications?.preferences ?? null;
  const section = getSection("notifications");
  const isVisible = isSectionVisible("notifications");
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileNotificationPreferences | null>(null);

  useEffect(() => {
    if (!preferences) {
      return;
    }

    setDraft({ ...preferences });
  }, [preferences]);

  const summary = useMemo(() => {
    if (!draft && !preferences) {
      return null;
    }

    const source = draft ?? preferences;
    if (!source) {
      return null;
    }

    const enabledChannels = [source.emailEnabled, source.smsEnabled, source.inAppEnabled].filter(Boolean).length;
    const enabledCategories = [source.workflowEnabled, source.securityEnabled, source.releaseEnabled, source.complianceEnabled].filter(Boolean).length;

    return {
      enabledChannels,
      enabledCategories,
      deliveryCoverage: `${enabledChannels}/3 channels`,
      categoryCoverage: `${enabledCategories}/4 categories`,
    };
  }, [draft, preferences]);

  if (!loading && !isVisible) {
    return (
      <Card>
        <CardContent>
          <Notice title="Notification section unavailable">
            {section?.reason ?? "This section is not available for the current role."}
          </Notice>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Profile"
          title="Notifications"
          description="Manage the live notification preferences for this account."
        />
        <Card>
          <CardContent>
            <Notice title={error ? "Unable to load profile" : "Loading notification preferences"}>
              {error ?? "The backend snapshot is still loading. This page never falls back to mocked defaults."}
            </Notice>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPreferences = draft ?? preferences;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

    if (!currentPreferences) {
      setFormError("Notification preferences are not available yet.");
      return;
    }

    startTransition(async () => {
      try {
        await updateNotifications(currentPreferences);
        setMessage("Notification preferences were saved and audited.");
      } catch (caught) {
        setFormError(caught instanceof Error ? caught.message : "Unable to update notification preferences.");
      }
    });
  }

  function updatePreference(key: PreferenceKey, value: boolean) {
    setDraft((current) => (current ? ({ ...current, [key]: value } as ProfileNotificationPreferences) : current));
  }

  const channelCards = [
    {
      key: "emailEnabled" as const,
      label: "Email delivery",
      hint: "Workflow, release and account alerts can be delivered through email.",
      icon: Mail,
    },
    {
      key: "smsEnabled" as const,
      label: "SMS delivery",
      hint: "Reserved for urgent alerts and high-priority workflow signals.",
      icon: Smartphone,
    },
    {
      key: "inAppEnabled" as const,
      label: "In-app feed",
      hint: "Keep web dashboard notifications visible inside the product surface.",
      icon: Bell,
    },
  ];

  const categoryCards = [
    {
      key: "workflowEnabled" as const,
      label: "Workflow updates",
      hint: "Task, trigger and approval events from the live backend workflow.",
    },
    {
      key: "securityEnabled" as const,
      label: "Security alerts",
      hint: "Sign-in, MFA and session notices tied to the security ledger.",
    },
    {
      key: "releaseEnabled" as const,
      label: "Release notifications",
      hint: "Document release activity and access changes from the continuity flow.",
    },
    {
      key: "complianceEnabled" as const,
      label: "Compliance notices",
      hint: "Policy, retention and audit reminders from the compliance surface.",
    },
  ];

  const lastReviewedAt = notifications?.lastReviewedAt ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Notifications"
        description="Control which channels receive workflow, security, release and compliance alerts. Every change is persisted in the profile aggregate and written to the audit trail."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {message ? (
        <Notice title="Saved">
          {message}
        </Notice>
      ) : null}

      {formError ? (
        <Notice title="Unable to save" className="border-red-200 bg-red-50 text-red-700">
          {formError}
        </Notice>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
          <CardContent className="space-y-5">
            <SectionHeader
              title="Delivery preferences"
              description="These controls map directly to the persisted profile preferences."
            />

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4">
                {channelCards.map((item) => {
                  const Icon = item.icon;
                  const checked = currentPreferences?.[item.key] ?? false;

                  return (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-5 rounded-[24px] border border-[#E5ECF5] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.03)]"
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <FieldLabel className="mb-0">{item.label}</FieldLabel>
                          <FieldHint className="max-w-2xl">{item.hint}</FieldHint>
                        </div>
                      </div>
                      <div className="pt-1">
                        <Checkbox
                          checked={checked}
                          onChange={(event) => updatePreference(item.key, event.target.checked)}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4">
                {categoryCards.map((item) => {
                  const checked = currentPreferences?.[item.key] ?? false;

                  return (
                    <div key={item.key} className="flex items-start justify-between gap-5 rounded-[24px] border border-[#E5ECF5] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.03)]">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A]">{item.label}</p>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{item.hint}</p>
                      </div>
                      <div className="pt-1">
                        <Checkbox
                          checked={checked}
                          onChange={(event) => updatePreference(item.key, event.target.checked)}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isPending || !currentPreferences}>
                  <CheckCheck className="h-4 w-4" />
                  {isPending ? "Saving..." : "Save notifications"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refresh()}>
                  <RefreshCw className="h-4 w-4" />
                  Reload profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Live summary"
                description="A readout of the persisted notification posture from the backend snapshot."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Channels enabled</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{summary?.enabledChannels ?? 0}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{summary?.deliveryCoverage ?? "Loading..."}</p>
                </div>

                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Categories enabled</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{summary?.enabledCategories ?? 0}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{summary?.categoryCoverage ?? "Loading..."}</p>
                </div>

                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Last reviewed</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                    {lastReviewedAt ? formatDateTime(lastReviewedAt) : "Not reviewed yet"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    The same timestamp is persisted in the profile preferences row and refreshed on every save.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={currentPreferences?.emailEnabled ? "success" : "secondary"}>Email</Badge>
                <Badge variant={currentPreferences?.smsEnabled ? "success" : "secondary"}>SMS</Badge>
                <Badge variant={currentPreferences?.inAppEnabled ? "success" : "secondary"}>In-app</Badge>
                <Badge variant={currentPreferences?.workflowEnabled ? "success" : "secondary"}>Workflow</Badge>
                <Badge variant={currentPreferences?.securityEnabled ? "success" : "secondary"}>Security</Badge>
                <Badge variant={currentPreferences?.releaseEnabled ? "success" : "secondary"}>Release</Badge>
                <Badge variant={currentPreferences?.complianceEnabled ? "success" : "secondary"}>Compliance</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Role-aware notes"
                description="This section stays explicit about what the backend will and will not deliver."
              />

              <div className="space-y-3">
                {[
                  "Email, SMS and in-app delivery are backed by the live profile preferences row.",
                  "Workflow, security, release and compliance categories save directly to the backend aggregate.",
                  "WhatsApp and push remain future-only channels unless the backend adds them.",
                  "Every saved change creates an audit record and a profile notification event.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#163B8B]" />
                    <p className="text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
