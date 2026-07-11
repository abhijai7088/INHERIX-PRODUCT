"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, FileCheck, ShieldAlert, ShieldCheck, Upload, UserCheck } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { getAccountLabel, inferAccountRole, type AccountRole } from "@/lib/account";
import { formatDateTime } from "@/lib/records";
import { getCurrentUser, listTriggerRequests, type TriggerRequest } from "@/lib/trigger-api";
import {
  formatTriggerRequestKind,
  getTriggerPriorityTone,
  getTriggerStatusTone,
  triggerRequestStatusLabels,
} from "@/lib/trigger-workflow";

function isOpenStatus(status: TriggerRequest["status"]) {
  return status === "DRAFT" || status === "PENDING" || status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED";
}

export default function EmergencyDashboardPage() {
  const authHelpText = "Sign in to view the trigger workflow.";
  const [userRole, setUserRole] = useState<AccountRole | null>(null);
  const [requests, setRequests] = useState<TriggerRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [me, triggerData] = await Promise.all([getCurrentUser(), listTriggerRequests()]);
        setUserRole(inferAccountRole(me.user.role, me.permissions));
        setRequests(triggerData.requests);
      } catch (loadError) {
        setError(isAuthenticationError(loadError) ? authHelpText : getErrorMessage(loadError, "Unable to load trigger requests."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const latestRequest = useMemo(() => [...requests].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null, [requests]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      open: requests.filter((request) => isOpenStatus(request.status)).length,
      inReview: requests.filter((request) => request.status === "UNDER_REVIEW").length,
      needsInfo: requests.filter((request) => request.status === "ADDITIONAL_INFO_REQUIRED").length,
      approved: requests.filter((request) => request.status === "APPROVED").length,
    }),
    [requests]
  );

  const primaryActionHref =
    latestRequest?.status === "ADDITIONAL_INFO_REQUIRED"
      ? `/dashboard/emergency/upload-proof?requestId=${latestRequest.id}`
      : latestRequest?.status === "DRAFT" || latestRequest?.status === "PENDING" || latestRequest?.status === "UNDER_REVIEW"
        ? `/dashboard/emergency/upload-proof?requestId=${latestRequest.id}`
        : userRole === "NOMINEE"
          ? "/dashboard/released-documents/request"
          : "/dashboard/emergency/request";

  const canCreate = userRole === "CUSTOMER";
  const accountLabel = getAccountLabel(userRole);
  const canReviewQueue = userRole === "VERIFICATION_OFFICER" || userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Trigger workflow</Badge>
              <Badge variant="secondary">Backend-backed</Badge>
              <Badge variant="secondary">Audit logged</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                Controlled continuity request flow
              </p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Track trigger requests and proof uploads from one protected workspace.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                Requests are stored in PostgreSQL, proof uploads use signed temporary URLs, and no unreleased vault data is exposed here.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {canCreate ? (
                <Button asChild size="lg">
                  <Link href="/dashboard/emergency/request">
                    <ShieldAlert className="h-4 w-4" />
                    Start request
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" variant="outline">
                  <Link href="/dashboard/released-documents/request">
                    <ShieldAlert className="h-4 w-4" />
                    Open nominee request desk
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link href={primaryActionHref}>
                  <Upload className="h-4 w-4" />
                  Continue workflow
                </Link>
              </Button>
              {canReviewQueue ? (
                <Button asChild variant="outline" size="lg">
                  <Link href="/dashboard/emergency/verification">
                    <ShieldCheck className="h-4 w-4" />
                    Review queue
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Total requests</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : stats.total}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Open</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : stats.open}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">In review</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : stats.inReview}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Needs info</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : stats.needsInfo}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow rules</CardTitle>
            <CardDescription>
              Requests can be drafted, submitted, and moved to proof review without exposing unreleased vault data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Nominee or customer creates a draft request.",
              "The request is submitted separately before proof is uploaded.",
              "Proof uploads use short-lived signed S3 URLs.",
              "Every sensitive action is written into the audit trail.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <FileCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {error === authHelpText ? (
        <Card className="border-[#C7D2FE] bg-[#EEF4FF]">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-[#0F172A]">{authHelpText}</p>
              <p className="text-sm leading-6 text-slate-600">
                The trigger workflow is tied to your signed-in account. Owners use the trigger request form, while nominees use the released documents desk and proof upload flow.
              </p>
            <Button asChild>
              <Link href="/onboarding/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current request</CardTitle>
            <CardDescription>
              The latest request stays visible here so the next step is obvious.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {latestRequest ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getTriggerStatusTone(latestRequest.status)}>{triggerRequestStatusLabels[latestRequest.status]}</Badge>
                  <Badge variant={getTriggerPriorityTone(latestRequest.priority)}>{latestRequest.priority}</Badge>
                  <Badge variant="secondary">{formatTriggerRequestKind(latestRequest.requestKind)}</Badge>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Request {latestRequest.id}</p>
                  <h2 className="text-2xl font-semibold text-[#0F172A]">{latestRequest.subjectLine}</h2>
                  <p className="max-w-3xl text-sm leading-7 text-slate-500">{latestRequest.summary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Nominee</p>
                    <p className="mt-2 font-semibold text-[#0F172A]">{latestRequest.nomineeName}</p>
                    <p className="mt-1 text-sm text-slate-500">{latestRequest.nomineeEmail ?? "No email on file"}</p>
                  </div>
                  <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Latest activity</p>
                    <p className="mt-2 font-semibold text-[#0F172A]">{formatDateTime(latestRequest.latestActivityAt)}</p>
                    <p className="mt-1 text-sm text-slate-500">{latestRequest.proofCount} proof upload{latestRequest.proofCount === 1 ? "" : "s"} recorded</p>
                  </div>
                </div>

                {latestRequest.additionalInfoReason ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">Additional information requested</p>
                    <p className="mt-2 text-sm leading-6 text-amber-900/80">{latestRequest.additionalInfoReason}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={primaryActionHref}>
                      {latestRequest.status === "ADDITIONAL_INFO_REQUIRED" ? "Respond now" : "Upload proof"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/emergency/request">Open request form</Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-[#163B8C]" />
                <p className="mt-4 text-base font-medium text-[#0F172A]">No requests yet</p>
                <p className="mt-2 text-sm text-slate-500">Start a draft trigger request to begin the controlled review flow.</p>
                {canCreate ? (
                  <Button asChild className="mt-5">
                    <Link href="/dashboard/emergency/request">Start request</Link>
                  </Button>
                ) : (
                  <Button className="mt-5" disabled>
                    Start request
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review summary</CardTitle>
              <CardDescription>Quick status at a glance for the current request set.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Requests waiting for review", value: stats.open },
                { label: "Requests waiting for more info", value: stats.needsInfo },
                { label: "Requests approved", value: stats.approved },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border border-[#DCE3EC] bg-white p-4">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#EEF4FF]">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-[#163B8C]" />
                <p className="text-sm font-medium text-[#0F172A]">Signed URL uploads only</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Proof files are uploaded directly to encrypted storage using a temporary signed URL. They are never stored in the database.
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <UserCheck className="h-4 w-4 text-[#163B8C]" />
                {accountLabel}
                <ShieldCheck className="ml-2 h-4 w-4 text-[#163B8C]" />
                Audit logged
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
