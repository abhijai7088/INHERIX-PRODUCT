"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Download, Eye, FileText, ShieldCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { formatBytes, formatDateTime } from "@/lib/records";
import { listEligibleDocumentRequests, type TriggerEligibleDocument } from "@/lib/trigger-api";
import { listReleasedDocuments, requestReleasedDocumentAccess, type ReleaseRecord } from "@/lib/release-api";
import { loadCurrentNominee, type NomineeApiRecord } from "@/lib/nominees";

function isActiveNomineeRequest(status: TriggerEligibleDocument["requestStatus"]) {
  return status === "PENDING" || status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED";
}

function isApprovedNomineeRequest(document: TriggerEligibleDocument) {
  return document.releaseStatus === "RELEASED";
}

function getNomineeDocumentAction(document: TriggerEligibleDocument) {
  if (isApprovedNomineeRequest(document)) {
    return {
      label: "Open approved access",
      href: "/dashboard/released-documents#released-documents",
      helperText: "Jump to the approved documents section and open the controlled access record.",
    };
  }

  if (document.requestStatus === "APPROVED") {
    return {
      label: "Waiting for release",
      href: `/dashboard/released-documents/request?documentId=${encodeURIComponent(document.documentId)}`,
      helperText: "The request is approved, but controlled access opens only when the release record is active.",
    };
  }

  if (isActiveNomineeRequest(document.requestStatus) && document.requestId) {
    return {
      label: document.requestStatus === "ADDITIONAL_INFO_REQUIRED" ? "Upload more proof" : "Continue proof",
      href: `/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(document.requestId)}`,
      helperText: "Continue the current proof submission and keep the case moving.",
    };
  }

  return {
    label: document.requestStatus === "REJECTED" || document.releaseStatus === "REVOKED" ? "Request again" : "Request access",
    href: `/dashboard/released-documents/request?documentId=${encodeURIComponent(document.documentId)}`,
    helperText: "Start a controlled request for this document and move into proof upload.",
  };
}

export default function ReleasedDocumentsPage() {
  const authHelpText = "Sign in to view released documents.";
  const [ticketMessage, setTicketMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);

  const { data: documentsData, error: swrError } = useSWR(
    "/api/nominee/documents/combined",
    async () => {
      const nomineePayload = await loadCurrentNominee().catch(() => null);
      const [releasedPayload, eligiblePayload] = await Promise.all([
        listReleasedDocuments(),
        listEligibleDocumentRequests(),
      ]);
      return {
        releases: releasedPayload.releases,
        eligibleDocuments: eligiblePayload.documents,
        currentNominee: nomineePayload?.nominee ?? null,
      };
    },
    { refreshInterval: 5000 }
  );

  const releases = documentsData?.releases ?? [];
  const eligibleDocuments = documentsData?.eligibleDocuments ?? [];
  const currentNominee = documentsData?.currentNominee ?? null;
  const loading = !documentsData && !swrError;

  if (swrError && !error) {
    setError(isAuthenticationError(swrError) ? authHelpText : getErrorMessage(swrError, "Unable to load released documents."));
  }

  const releasedCount = useMemo(() => releases.length, [releases.length]);
  const readyCount = useMemo(() => releases.filter((release) => release.canView || release.canDownload).length, [releases]);
  const nomineeAssignedDocuments = currentNominee?.assignedDocuments ?? [];
  const nomineeDocumentCards = useMemo<TriggerEligibleDocument[]>(() => {
    if (eligibleDocuments.length) {
      return eligibleDocuments;
    }

    return nomineeAssignedDocuments.map((document) => ({
      documentId: document.documentId,
      documentTitle: document.documentTitle,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      categoryId: document.categoryId,
      categoryName: document.categoryName,
      canView: document.canView,
      canDownload: document.canDownload,
      releaseCondition: document.releaseCondition,
      conditionNotes: document.conditionNotes,
      requestId: null,
      requestStatus: null,
      requestKind: null,
      proofCount: 0,
      latestProofStatus: null,
      latestProofAt: null,
      releaseId: null,
      releaseStatus: null,
      releaseNotes: null,
      releasedAt: null,
      revokedAt: null,
      latestActivityAt: document.documentUpdatedAt,
    }));
  }, [eligibleDocuments, nomineeAssignedDocuments]);
  const eligibleCount = useMemo(() => nomineeDocumentCards.length, [nomineeDocumentCards]);
  const waitingCount = useMemo(() => releases.filter((release) => release.releaseStatus === "PENDING").length, [releases]);
  const revokedCount = useMemo(() => releases.filter((release) => release.releaseStatus === "REVOKED").length, [releases]);
  const awaitingOfficerReviewCount = useMemo(
    () =>
      nomineeDocumentCards.filter(
        (document) =>
          document.requestStatus === "PENDING" ||
          document.requestStatus === "UNDER_REVIEW" ||
          document.requestStatus === "ADDITIONAL_INFO_REQUIRED"
      ).length,
    [nomineeDocumentCards]
  );
  const linkedNomineeRequest = useMemo(
    () =>
      nomineeDocumentCards.find((document) => isActiveNomineeRequest(document.requestStatus)) ??
      nomineeDocumentCards.find((document) => Boolean(document.requestId)) ??
      null,
    [nomineeDocumentCards]
  );
  const currentRequestStatus = useMemo(() => {
    if (linkedNomineeRequest?.requestStatus) {
      if (linkedNomineeRequest.requestStatus === "PENDING") {
        return "Ready for proof upload";
      }

      if (linkedNomineeRequest.requestStatus === "UNDER_REVIEW") {
        return "Waiting for officer review";
      }

      if (linkedNomineeRequest.requestStatus === "ADDITIONAL_INFO_REQUIRED") {
        return "Additional proof needed";
      }

      if (linkedNomineeRequest.requestStatus === "APPROVED") {
        return linkedNomineeRequest.releaseStatus === "RELEASED" ? "Approved and ready" : "Approved, waiting for release";
      }

      if (linkedNomineeRequest.requestStatus === "REJECTED") {
        return "Request rejected";
      }

      if (linkedNomineeRequest.requestStatus === "CANCELLED") {
        return "Request cancelled";
      }
    }

    if (nomineeDocumentCards.length) {
      return "Ready to request";
    }

    if (currentNominee?.assignedCount) {
      return "Waiting for an assigned document";
    }

    return "No assigned documents";
  }, [currentNominee?.assignedCount, linkedNomineeRequest, nomineeDocumentCards.length]);
  const proofFlowHref = useMemo(() => {
    if (linkedNomineeRequest && isApprovedNomineeRequest(linkedNomineeRequest)) {
      return "/dashboard/released-documents#released-documents";
    }

    if (linkedNomineeRequest?.requestId && isActiveNomineeRequest(linkedNomineeRequest.requestStatus)) {
      return `/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(linkedNomineeRequest.requestId)}`;
    }

    return "/dashboard/released-documents/request";
  }, [linkedNomineeRequest?.requestId, linkedNomineeRequest?.requestStatus]);
  const proofFlowLabel = useMemo(() => {
    if (linkedNomineeRequest && isApprovedNomineeRequest(linkedNomineeRequest)) {
      return "Open approved access";
    }

    if (linkedNomineeRequest?.requestId && isActiveNomineeRequest(linkedNomineeRequest.requestStatus)) {
      return linkedNomineeRequest.requestStatus === "ADDITIONAL_INFO_REQUIRED" ? "Upload more proof" : "Continue proof flow";
    }

    return "Request access";
  }, [linkedNomineeRequest?.requestId, linkedNomineeRequest?.requestStatus]);
  const proofStatusText = useMemo(() => {
    if (awaitingOfficerReviewCount > 0) {
      return `${awaitingOfficerReviewCount} document${awaitingOfficerReviewCount === 1 ? "" : "s"} are waiting for officer review.`;
    }

    if (!releases.length) {
      return "No approved documents are visible yet.";
    }

    if (waitingCount > 0) {
      return `${waitingCount} document${waitingCount === 1 ? "" : "s"} are still waiting on officer review.`;
    }

    if (revokedCount > 0) {
      return `${revokedCount} document${revokedCount === 1 ? "" : "s"} were revoked and are no longer accessible.`;
    }

    return "All visible documents are ready for controlled access.";
  }, [awaitingOfficerReviewCount, releases.length, revokedCount, waitingCount]);

  async function handleAccess(release: ReleaseRecord, action: "view" | "download") {
    setError(null);

    try {
      const payload = await requestReleasedDocumentAccess({
        releaseId: release.id,
        action,
      });

      if (action === "view") {
        setPreviewUrl(payload.download.url);
        setPreviewFileName(release.fileName ?? release.documentTitle);
      } else {
        const anchor = document.createElement("a");
        anchor.href = payload.download.url;
        anchor.rel = "noreferrer";
        anchor.download = release.fileName ?? release.documentTitle;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }

      setTicketMessage(
        `${action === "view" ? "Preview" : "Download"} token issued and expires at ${formatDateTime(payload.download.expiresAt)}.`
      );
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : "Unable to authorize document access.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Nominee workflow</Badge>
              <Badge variant="secondary">Access-rule documents</Badge>
              <Badge variant="secondary">Proof review</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">Nominee document desk</p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Work only with the owner documents explicitly assigned through access rules to your nominee account.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                Unreleased vault items stay hidden. This page keeps the nominee focused on access-rule documents, proof submission, and the current review state only.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/dashboard/released-documents/request">
                    <ArrowRight className="h-4 w-4" />
                    Open request desk
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked to customer</CardTitle>
            <CardDescription>
              The nominee account stays tied to one customer and only shows the access-rule workflow they assigned.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Linked session</Badge>
                <Badge variant={currentNominee?.status === "ACTIVE" ? "success" : "warning"}>
                  {currentNominee ? currentNominee.status : "Unlinked"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Owner</p>
                  <p className="mt-2 text-base font-semibold text-[#0F172A]">{currentNominee?.customerName ?? "Customer not loaded"}</p>
                  <p className="mt-1 text-sm text-slate-500">{currentNominee?.customerId ?? "No customer link yet"}</p>
                </div>
                <div className="rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nominee</p>
                  <p className="mt-2 text-base font-semibold text-[#0F172A]">{currentNominee?.fullName ?? "No nominee assignment"}</p>
                  <p className="mt-1 text-sm text-slate-500">{currentNominee?.email ?? "The invited nominee account is not linked yet."}</p>
                </div>
              </div>
            {currentNominee ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{currentNominee.relationship}</Badge>
                  <Badge variant="default">{currentNominee.assignedCount} assigned docs</Badge>
                  <Badge variant="secondary">{currentRequestStatus}</Badge>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={proofFlowHref}>
                    <ArrowRight className="h-4 w-4" />
                    {proofFlowLabel}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/released-documents/request">
                    Open request desk
                  </Link>
                </Button>
              </div>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Ready to access</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : readyCount}</p>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Waiting for review</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : awaitingOfficerReviewCount}</p>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Approved documents</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : releasedCount}</p>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Access-rule documents</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : eligibleCount}</p>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Proof status</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{proofStatusText}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
            <CardDescription>
              This is the nominee-only flow after acceptance. Start with an owner document, upload proof, then wait for officer review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "1. Open the request desk and choose one active owner document.",
              "2. Submit the request and upload the proof package the officer needs.",
              "3. Wait for officer review. The status here will show when the request is pending, under review, or needs more information.",
              "4. After approval, the document appears in the approved documents area on this page.",
            ].map((step) => (
              <div key={step} className="rounded-[22px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                <p className="text-sm leading-6 text-slate-600">{step}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <Link href="/dashboard/released-documents/request">
                  <ArrowRight className="h-4 w-4" />
                  Open request desk
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/emergency/upload-proof">
                  <FileText className="h-4 w-4" />
                  Upload proof
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
              <CardTitle>Current review state</CardTitle>
              <CardDescription>What the backend is currently allowing this nominee to do.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Visible access-rule documents</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : releasedCount}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Only documents explicitly assigned to this nominee and approved releases are surfaced.
              </p>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Next step</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use the request desk to choose a document, then continue through proof upload and officer review.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {error === authHelpText ? (
        <Card className="border-[#C7D2FE] bg-[#EEF4FF]">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-[#0F172A]">{authHelpText}</p>
            <p className="text-sm leading-6 text-slate-600">
              Released documents are tied to your account and the active release record. Sign back in to continue.
            </p>
            <Button asChild>
              <a href="/onboarding/login">Go to login</a>
            </Button>
          </CardContent>
        </Card>
      ) : error?.includes("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY") ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-amber-900">AWS signing is not configured yet.</p>
            <p className="text-sm leading-6 text-amber-800/90">
              Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to `backend/.env`, then restart the backend so preview and download tokens can be issued.
            </p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {ticketMessage ? (
        <Card className="border-[#C7E3D1] bg-[#F2FBF5]">
          <CardContent className="flex items-center gap-3 p-5">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{ticketMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6">
        {nomineeDocumentCards.length ? (
          <Card id="released-documents">
            <CardHeader>
              <CardTitle>Owner documents</CardTitle>
              <CardDescription>These are the active documents saved by the customer that you can request through the nominee workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {nomineeDocumentCards.map((document) => {
                const documentAction = getNomineeDocumentAction(document);

                return (
                  <div key={document.documentId} className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 transition hover:border-[#163B8C] hover:bg-white">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-[#0F172A]">{document.documentTitle}</h3>
                          <Badge variant={document.canView ? "success" : "secondary"}>{document.canView ? "View eligible" : "View blocked"}</Badge>
                          <Badge variant={document.canDownload ? "success" : "secondary"}>{document.canDownload ? "Download eligible" : "Download blocked"}</Badge>
                          <Badge
                            variant={
                              isApprovedNomineeRequest(document)
                                ? "success"
                                : isActiveNomineeRequest(document.requestStatus)
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {document.requestStatus ? document.requestStatus.replaceAll("_", " ").toLowerCase() : "Request ready"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">
                          {document.categoryName} • {document.fileName ?? "Encrypted file"} • {formatBytes(document.fileSize ?? 0)}
                        </p>
                        <p className="text-sm leading-6 text-slate-600">
                          {document.releaseCondition ?? "Controlled access is available after the request is reviewed."}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Next action</p>
                          <p className="text-sm font-medium text-[#0F172A]">{documentAction.label}</p>
                          <p className="max-w-sm text-xs leading-5 text-slate-500">{documentAction.helperText}</p>
                        </div>
                        <Button asChild>
                          <Link href={documentAction.href}>
                            <ArrowRight className="h-4 w-4" />
                            {documentAction.label}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Released documents</CardTitle>
            <CardDescription>Only documents already released to you are visible here, together with the current access state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {releases.length ? (
              releases.map((release) => (
                <div key={release.id} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#0F172A]">{release.documentTitle}</h3>
                        <Badge variant={release.releaseStatus === "RELEASED" ? "success" : release.releaseStatus === "REVOKED" ? "destructive" : "warning"}>
                          {release.releaseStatus}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {release.categoryName} â€¢ Released {formatDateTime(release.releasedAt ?? release.updatedAt)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Trigger case {release.triggerRequestId} â€¢ Release {release.id}
                      </p>
                      <p className="text-sm leading-6 text-slate-600">{release.releaseNotes ?? "Released through controlled workflow."}</p>
                      <p className="text-xs text-slate-400">
                        {formatBytes(release.fileSize ?? 0)} â€¢ {release.fileName ?? "Encrypted file"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline">
                        <Link href={`/dashboard/released-documents/request?requestId=${encodeURIComponent(release.triggerRequestId)}`}>
                          <ArrowRight className="h-4 w-4" />
                          Open request flow
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant={release.canView ? "primary" : "outline"}
                        onClick={release.canView ? () => void handleAccess(release, "view") : undefined}
                        disabled={!release.canView}
                      >
                        <Eye className="h-4 w-4" />
                        {release.canView ? "View" : "Request access"}
                      </Button>
                      <Button
                        type="button"
                        variant={release.canDownload ? "outline" : "secondary"}
                        onClick={release.canDownload ? () => void handleAccess(release, "download") : undefined}
                        disabled={!release.canDownload}
                      >
                        <Download className="h-4 w-4" />
                        {release.canDownload ? "Download" : "Request download"}
                      </Button>
                      {!release.canView || !release.canDownload ? (
                        <Button asChild variant="outline">
                          <Link href={`/dashboard/released-documents/request?documentId=${encodeURIComponent(release.documentId)}&requestId=${encodeURIComponent(release.triggerRequestId)}`}>
                            <ArrowRight className="h-4 w-4" />
                            Open proof flow
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center">
                <FileText className="mx-auto h-10 w-10 text-[#163B8B]" />
                <p className="mt-4 text-base font-medium text-[#0F172A]">No access-rule documents yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  The owner has not assigned any documents or categories to this nominee yet.
                </p>
                <div className="mx-auto mt-5 max-w-md rounded-[22px] border border-[#DCE3EC] bg-white p-4 text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Next step</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <li>Ask the owner to create an access rule for a document or category.</li>
                    <li>Refresh this page after the rule is saved.</li>
                    <li>The assigned document will appear here and in the proof request desk.</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6 lg:p-8">
          <Card className="w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <CardTitle>Document Preview</CardTitle>
                <CardDescription>
                  {previewFileName ? `Viewing: ${previewFileName}` : "Review the released document."}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(null)}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-slate-500"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 bg-slate-50 relative min-h-[500px] flex items-center justify-center">
              {previewFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img
                  src={previewUrl}
                  alt={previewFileName}
                  className="max-h-full max-w-full object-contain"
                />
              ) : previewFileName?.match(/\.(pdf)$/i) ? (
                <iframe
                  src={previewUrl}
                  className="absolute inset-0 h-full w-full border-0"
                  title="Document Viewer"
                  allowFullScreen
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <FileText className="h-16 w-16 text-slate-300 mb-4" />
                  <p className="text-lg font-medium text-slate-900 mb-2">Preview not available</p>
                  <p className="text-sm text-slate-500 max-w-sm mb-6">
                    This file type ({previewFileName?.split('.').pop()?.toUpperCase() ?? 'Unknown'}) cannot be previewed directly in the browser. 
                  </p>
                  <Button asChild>
                    <a href={previewUrl} download={previewFileName ?? "document"}>
                      <Download className="mr-2 h-4 w-4" />
                      Download to view
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}



