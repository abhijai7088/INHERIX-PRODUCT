"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Download, Eye, FileDown, RefreshCw, ShieldCheck, Smartphone, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Checkbox } from "@/components/inherix/checkbox";
import { FieldHint, FieldLabel, FormField } from "@/components/inherix/field";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { formatDateTime } from "@/lib/records";

import { useProfile } from "@/hooks/use-profile";
import type { ProfilePrivacyRequest } from "@/types/profile";

function getRequestBadgeVariant(status: ProfilePrivacyRequest["status"]) {
  if (status === "COMPLETED" || status === "APPROVED") return "success";
  if (status === "REQUESTED") return "warning";
  return "destructive";
}

function getRequestStatusLabel(status: ProfilePrivacyRequest["status"]) {
  if (status === "COMPLETED") return "Completed";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Requested";
}

function getRequestTypeLabel(requestType: ProfilePrivacyRequest["requestType"]) {
  if (requestType === "DATA_EXPORT") return "Data export";
  return "Account deletion";
}

export default function PrivacyProfilePage() {
  const {
    privacy,
    loading,
    updatePrivacy,
    requestPrivacyDataExport,
    requestPrivacyDeletion,
    refresh,
    isSectionVisible,
    getSection,
  } = useProfile();
  const section = getSection("privacy");
  const isVisible = isSectionVisible("privacy");

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [shareContactWithNominees, setShareContactWithNominees] = useState(false);
  const [shareActivityWithNominees, setShareActivityWithNominees] = useState(false);
  const [allowDataExports, setAllowDataExports] = useState(false);
  const [allowTrustedDeviceTracking, setAllowTrustedDeviceTracking] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const [deletionReason, setDeletionReason] = useState("");

  useEffect(() => {
    if (!privacy) {
      return;
    }

    setShareContactWithNominees(privacy.preferences.shareContactWithNominees);
    setShareActivityWithNominees(privacy.preferences.shareActivityWithNominees);
    setAllowDataExports(privacy.preferences.allowDataExports);
    setAllowTrustedDeviceTracking(privacy.preferences.allowTrustedDeviceTracking);
  }, [privacy]);

  const requests = useMemo(() => [...(privacy?.requests ?? [])], [privacy]);
  const latestExportRequest = requests.find((request) => request.requestType === "DATA_EXPORT") ?? null;
  const latestDeletionRequest = requests.find((request) => request.requestType === "ACCOUNT_DELETION") ?? null;

  if (!loading && !isVisible) {
    return (
      <Card>
        <CardContent>
          <Notice title="Privacy section unavailable">
            {section?.reason ?? "This section is not available for the current role."}
          </Notice>
        </CardContent>
      </Card>
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage(null);
    setFormError(null);
    setIsSaving(true);

    try {
      await updatePrivacy({
        shareContactWithNominees,
        shareActivityWithNominees,
        allowDataExports,
        allowTrustedDeviceTracking,
      });
      setActionMessage("Privacy preferences were saved and audited.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to update privacy preferences.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRequestExport() {
    setActionMessage(null);
    setFormError(null);
    setIsExporting(true);

    try {
      await requestPrivacyDataExport({
        reason: exportReason.trim() || null,
      });
      setActionMessage("Your data export was prepared and recorded in the privacy ledger.");
      setExportReason("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to request a data export.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleRequestDeletion() {
    const confirmed = window.confirm(
      "Requesting account deletion starts a governed review workflow. The account is not deleted immediately."
    );

    if (!confirmed) {
      return;
    }

    setActionMessage(null);
    setFormError(null);
    setIsDeleting(true);

    try {
      await requestPrivacyDeletion({
        reason: deletionReason.trim() || null,
      });
      setActionMessage("Your deletion request was recorded and sent into the review workflow.");
      setDeletionReason("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to request account deletion.");
    } finally {
      setIsDeleting(false);
    }
  }

  const exportEnabled = allowDataExports && privacy?.preferences.allowDataExports;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Privacy"
        description="Manage sharing preferences, data export requests and governed account-deletion workflows from one desktop-grade control surface."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRequestExport()}
              disabled={!exportEnabled || isExporting}
            >
              <FileDown className="h-4 w-4" />
              {isExporting ? "Preparing export..." : "Request export"}
            </Button>
          </div>
        }
      />

      {actionMessage ? <Notice title="Saved">{actionMessage}</Notice> : null}

      {formError ? (
        <Notice title="Unable to complete action" className="border-red-200 bg-red-50 text-red-700">
          {formError}
        </Notice>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Sharing and export"
              description="These controls are persisted in the profile aggregate and audited on every mutation."
            />

            <form className="space-y-4" onSubmit={handleSave}>
              {[
                {
                  key: "share-contact",
                  label: "Share contact details with nominees",
                  hint: "Let nominees see approved contact details in continuity workflows.",
                  icon: Users,
                  checked: shareContactWithNominees,
                  setChecked: setShareContactWithNominees,
                },
                {
                  key: "share-activity",
                  label: "Share activity with nominees",
                  hint: "Allow nominee views to include selected activity context.",
                  icon: Eye,
                  checked: shareActivityWithNominees,
                  setChecked: setShareActivityWithNominees,
                },
                {
                  key: "exports",
                  label: "Allow data exports",
                  hint: "Permit controlled export requests through the live backend workflow.",
                  icon: Download,
                  checked: allowDataExports,
                  setChecked: setAllowDataExports,
                },
                {
                  key: "tracking",
                  label: "Allow trusted device tracking",
                  hint: "Track trusted devices for support and security diagnostics.",
                  icon: Smartphone,
                  checked: allowTrustedDeviceTracking,
                  setChecked: setAllowTrustedDeviceTracking,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <FormField key={item.key} className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <FieldLabel className="mb-0">{item.label}</FieldLabel>
                          <FieldHint className="mt-1">{item.hint}</FieldHint>
                        </div>
                      </div>
                      <Checkbox checked={item.checked} onChange={(event) => item.setChecked(event.target.checked)} />
                    </div>
                  </FormField>
                );
              })}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving}>
                  <ShieldCheck className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save privacy"}
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
                title="Request workflows"
                description="Export requests complete immediately; deletion requests start a governed review path."
              />

              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">Data export</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Export your live profile snapshot and related privacy controls from the backend ledger.
                      </p>
                    </div>
                    <Badge variant={latestExportRequest ? getRequestBadgeVariant(latestExportRequest.status) : "secondary"}>
                      {latestExportRequest ? getRequestStatusLabel(latestExportRequest.status) : "Ready"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-[20px] border border-[#EEF2F7] bg-[#FAFCFF] p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Latest export</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {latestExportRequest
                          ? `${getRequestStatusLabel(latestExportRequest.status)} on ${formatDateTime(latestExportRequest.requestedAt)}`
                          : "No export request has been recorded yet."}
                      </p>
                      {latestExportRequest?.reason ? (
                        <p className="mt-2 text-sm text-slate-500">Reason: {latestExportRequest.reason}</p>
                      ) : null}
                    </div>

                    <FormField className="space-y-2 rounded-[20px] border border-[#EEF2F7] bg-[#FAFCFF] p-4">
                      <FieldLabel>Export reason</FieldLabel>
                      <FieldHint>Optional, but useful for audit context and support traceability.</FieldHint>
                      <textarea
                        value={exportReason}
                        onChange={(event) => setExportReason(event.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#163B8C] focus:ring-2 focus:ring-[#163B8C]/10"
                        placeholder="Why do you need this export?"
                        disabled={!exportEnabled}
                      />
                    </FormField>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRequestExport()}
                        disabled={!exportEnabled || isExporting}
                      >
                        <FileDown className="h-4 w-4" />
                        {isExporting ? "Preparing..." : "Request export"}
                      </Button>
                      {!exportEnabled ? (
                        <Badge variant="secondary">Exports are currently disabled in privacy preferences</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-red-100 bg-red-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-red-900">Account deletion request</p>
                      <p className="mt-1 text-sm leading-6 text-red-700">
                        This does not delete the account immediately. It creates an auditable, governed request for review.
                      </p>
                    </div>
                    <Badge variant={latestDeletionRequest ? getRequestBadgeVariant(latestDeletionRequest.status) : "secondary"}>
                      {latestDeletionRequest ? getRequestStatusLabel(latestDeletionRequest.status) : "Ready"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-[20px] border border-red-100 bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-red-600">Latest deletion request</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {latestDeletionRequest
                          ? `${getRequestStatusLabel(latestDeletionRequest.status)} on ${formatDateTime(latestDeletionRequest.requestedAt)}`
                          : "No deletion request has been recorded yet."}
                      </p>
                      {latestDeletionRequest?.reason ? (
                        <p className="mt-2 text-sm text-slate-500">Reason: {latestDeletionRequest.reason}</p>
                      ) : null}
                    </div>

                    <FormField className="space-y-2 rounded-[20px] border border-red-100 bg-white p-4">
                      <FieldLabel>Deletion reason</FieldLabel>
                      <FieldHint>Help the review team understand the request context.</FieldHint>
                      <textarea
                        value={deletionReason}
                        onChange={(event) => setDeletionReason(event.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-200"
                        placeholder="Why are you requesting deletion?"
                      />
                    </FormField>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleRequestDeletion()}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? "Submitting..." : "Request deletion"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader title="Privacy summary" description="The current profile privacy posture." />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Last review</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                    {privacy?.lastReviewedAt ? formatDateTime(privacy.lastReviewedAt) : "Not available"}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Retention note</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {privacy?.retentionNote ?? "Loading..."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={shareContactWithNominees ? "success" : "secondary"}>Contact sharing</Badge>
                <Badge variant={shareActivityWithNominees ? "success" : "secondary"}>Activity sharing</Badge>
                <Badge variant={allowDataExports ? "success" : "secondary"}>Exports enabled</Badge>
                <Badge variant={allowTrustedDeviceTracking ? "success" : "secondary"}>Trusted devices</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader title="Request ledger" description="Recent privacy requests recorded by the backend." />

              <div className="space-y-3">
                {requests.length ? (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#0F172A]">{getRequestTypeLabel(request.requestType)}</p>
                            <Badge variant={getRequestBadgeVariant(request.status)}>
                              {getRequestStatusLabel(request.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Requested {formatDateTime(request.requestedAt)}
                            {request.completedAt ? ` · Completed ${formatDateTime(request.completedAt)}` : ""}
                          </p>
                          {request.reason ? (
                            <p className="mt-2 text-sm text-slate-600">Reason: {request.reason}</p>
                          ) : null}
                          {request.reviewNotes ? (
                            <p className="mt-2 text-sm text-slate-600">Review notes: {request.reviewNotes}</p>
                          ) : null}
                        </div>
                        <Clock3 className="h-4 w-4 text-[#163B8C]" />
                      </div>
                    </div>
                  ))
                ) : (
                  <Notice title="No privacy requests yet">
                    Requests you make from this page will appear here once the backend records them.
                  </Notice>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Audit and safety"
                description="Privacy mutations follow the same audit expectations as security changes."
              />

              <div className="space-y-3">
                {[
                  "Every save writes a profile audit record.",
                  "Export requests are stored in the privacy workflow ledger.",
                  "Deletion requests are governed and not destructive by default.",
                  "Nominee access remains hidden by role.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#163B8C]" />
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
