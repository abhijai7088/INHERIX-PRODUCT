"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, ChevronRight, FileText, Lock, ShieldCheck, UploadCloud } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import { formatBytes, formatDateTime } from "@/lib/records";
import { inferAccountRole, type AccountRole } from "@/lib/account";
import {
  deleteUnreviewedTriggerProof,
  getCurrentUser,
  getTriggerRequest,
  listTriggerRequests,
  prepareTriggerProofUpload,
  type TriggerDetail,
} from "@/lib/trigger-api";
import {
  formatTriggerRequestKind,
  getTriggerStatusTone,
  getTriggerProofStatusTone,
  triggerProofStatusLabels,
  triggerRequestStatusLabels,
} from "@/lib/trigger-workflow";

function UploadProofContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");
  const [role, setRole] = useState<AccountRole | null>(null);
  const [request, setRequest] = useState<TriggerDetail["request"] | null>(null);
  const [proofs, setProofs] = useState<TriggerDetail["proofs"]>([]);
  const [timeline, setTimeline] = useState<TriggerDetail["timeline"]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getCurrentUser();
        setRole(inferAccountRole(me.user.role, me.permissions));

        let selectedRequestId = requestId;
        if (!selectedRequestId) {
          const list = await listTriggerRequests();
          selectedRequestId = list.requests[0]?.id ?? null;
        }

        if (!selectedRequestId) {
          setRequest(null);
          setProofs([]);
          setTimeline([]);
          return;
        }

        const detail = await getTriggerRequest(selectedRequestId);
        setRequest(detail.request);
        setProofs(detail.proofs);
        setTimeline(detail.timeline);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the proof workflow.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [requestId]);

  const canUpload = useMemo(
    () => role === "CUSTOMER" || role === "NOMINEE",
    [role]
  );
  const latestProof = proofs[0] ?? null;
  const requestStateLabel = useMemo(() => {
    if (!request) {
      return "No request selected.";
    }

    if (request.status === "APPROVED") {
      return "Approved and ready for controlled release.";
    }

    if (request.status === "ADDITIONAL_INFO_REQUIRED") {
      return "Additional information is required before review can continue.";
    }

    if (request.status === "UNDER_REVIEW") {
      return "The proof is currently with the review team.";
    }

    if (request.status === "PENDING") {
      return "The request is waiting to move into review.";
    }

    if (request.status === "REJECTED") {
      return "This request was rejected.";
    }

    return request.status.replaceAll("_", " ").toLowerCase();
  }, [request]);
  const proofStateLabel = useMemo(() => {
    if (!latestProof) {
      return "No proof uploaded yet.";
    }
    return latestProof.verificationStatus === "REJECTED"
      ? "Latest proof rejected. Upload the requested replacement."
      : `Latest proof ${triggerProofStatusLabels[latestProof.verificationStatus].toLowerCase()}.`;
  }, [latestProof]);
  const isClosedRequest = useMemo(
    () => Boolean(request && ["APPROVED", "REJECTED", "CANCELLED"].includes(request.status)),
    [request]
  );
  const releaseCenterHref = useMemo(
    () => "/dashboard/released-documents#released-documents",
    []
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!request) {
      setError("Choose a request first.");
      return;
    }

    if (!file) {
      setError("Select a proof file before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      const prepared = await prepareTriggerProofUpload({
        requestId: request.id,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        notes,
      });

      const putHeaders = new Headers(prepared.upload.requiredHeaders ?? {});
      const putResponse = await fetch(prepared.upload.url, {
        method: "PUT",
        headers: putHeaders,
        body: file,
      });

      if (!putResponse.ok) {
        await deleteUnreviewedTriggerProof(request.id, prepared.proof.id).catch(() => undefined);
        const payload = await putResponse.json().catch(() => null);
        throw new Error(
          payload?.message ??
            `The file could not be stored. Please try a smaller file or re-upload it. Upload status: ${putResponse.status}.`
        );
      }

      const detail = await getTriggerRequest(request.id);
      setRequest(detail.request);
      setProofs(detail.proofs);
      setTimeline(detail.timeline);
      setFile(null);
      setNotes("");
      setWorkflowNotice("Upload complete. Waiting for officer review.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload the proof file.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href="/dashboard/emergency/request">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Badge variant="default">Proof upload</Badge>
            <Badge variant="secondary">Signed URL</Badge>
            <Badge variant="secondary">Audit logged</Badge>
          </div>
          <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[40px]">
            Upload proof for the current request
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
            Files are uploaded directly to encrypted storage through a short-lived signed URL, then the backend keeps only metadata.
          </p>
        </div>

        <Card className="w-full max-w-[360px]">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <UploadCloud className="h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Upload status</p>
                <p className="text-xs text-slate-500">The request returns to review after proof upload.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F8FAFC] p-3 text-xs leading-6 text-slate-500">
              No proof content is stored in PostgreSQL and no public file URL is exposed.
            </div>

            {workflowNotice ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                {workflowNotice}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {request ? (
        <Card className="border-[#DCE3EC] bg-white">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Case context</p>
              <p className="text-sm leading-6 text-slate-600">
                You are working on request <span className="font-medium text-[#0F172A]">{request.id}</span> for {request.subjectLine}.
              </p>
              <p className="text-sm leading-6 text-slate-600">
                When the proof is uploaded, the request stays in the workflow and the review team can continue from the same case.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/emergency/request">Open request desk</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/released-documents">Open released documents</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {request ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Document detail</CardTitle>
              <CardDescription>Review the document and the current workflow state before you upload another file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getTriggerStatusTone(request.status)}>{triggerRequestStatusLabels[request.status]}</Badge>
                  <Badge variant="secondary">{formatTriggerRequestKind(request.requestKind)}</Badge>
                  <Badge variant="secondary">{request.priority}</Badge>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">{request.documentTitle ?? request.subjectLine}</h2>
                <p className="mt-1 text-sm leading-7 text-slate-500">{request.summary}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Nominee</p>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">{request.nomineeName}</p>
                    <p className="mt-1 text-sm text-slate-500">{request.nomineeEmail ?? "No nominee email on file"}</p>
                  </div>
                  <div className="rounded-[20px] border border-white bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Activity</p>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">{formatDateTime(request.latestActivityAt)}</p>
                    <p className="mt-1 text-sm text-slate-500">{proofs.length} proof item(s) attached</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Request state</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{requestStateLabel}</p>
                </div>
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Proof state</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{proofStateLabel}</p>
                </div>
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Next step</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                    {request.status === "ADDITIONAL_INFO_REQUIRED"
                      ? "Upload updated proof"
                      : latestProof?.verificationStatus === "VERIFIED"
                        ? "Open approved access"
                        : "Waiting for officer review"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proof review trail</CardTitle>
              <CardDescription>The officer will see every upload and its current verification status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {proofs.length ? (
                proofs.slice(0, 3).map((proof) => (
                  <div key={proof.id} className="rounded-[22px] border border-[#DCE3EC] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{proof.fileName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {proof.fileType} • {formatBytes(proof.fileSize)} • {formatDateTime(proof.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={getTriggerProofStatusTone(proof.verificationStatus)}
                      >
                        {triggerProofStatusLabels[proof.verificationStatus]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{proof.notes ?? "No notes provided."}</p>
                    {proof.adminRemarks ? <p className="mt-2 text-xs text-slate-400">Reviewer note: {proof.adminRemarks}</p> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                  No proof has been uploaded yet. Your first upload will start the review trail.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Proof details</CardTitle>
            <CardDescription>Select one file and explain why it supports this request.</CardDescription>
          </CardHeader>
          <CardContent>
              {loading ? (
                <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center text-sm text-slate-500">
                  Loading request details...
                </div>
              ) : request ? (
                isClosedRequest ? (
                  <div className="space-y-6">
                    <div className="rounded-[24px] border border-[#C7D2FE] bg-[#EEF4FF] p-5">
                      <p className="text-sm font-semibold text-[#0F172A]">This request is already approved</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Proof upload is closed for this case. Open the approved documents section to view the controlled access record and continue from there.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button asChild>
                          <Link href={releaseCenterHref}>Open approved access</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/dashboard/released-documents">Back to assigned documents</Link>
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                      Latest proof status: {proofStateLabel}
                    </div>
                  </div>
                ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getTriggerStatusTone(request.status)}>{triggerRequestStatusLabels[request.status]}</Badge>
                  <Badge variant="secondary">{formatTriggerRequestKind(request.requestKind)}</Badge>
                  <Badge variant="secondary">{request.priority}</Badge>
                </div>

                <div className="space-y-2 rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Current request</p>
                  <h2 className="text-xl font-semibold text-[#0F172A]">{request.subjectLine}</h2>
                  <p className="text-sm leading-7 text-slate-500">{request.summary}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{request.nomineeName}</span>
                    <span>•</span>
                    <span>{formatDateTime(request.latestActivityAt)}</span>
                    <span>•</span>
                    <span>{proofs.length} proof item(s)</span>
                  </div>
                </div>

                {request.status === "ADDITIONAL_INFO_REQUIRED" ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Additional information requested</p>
                        <p className="mt-1 text-sm leading-6 text-amber-900/80">{request.additionalInfoReason ?? "Please attach the requested supporting file."}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <label className="text-sm font-medium text-[#0F172A]">Proof file</label>
                  {!file ? (
                    <div className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-10 transition-all duration-300 hover:border-[#163B8C] hover:bg-[#F0F5FF]">
                      <input
                        type="file"
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[#163B8C] shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105">
                        <UploadCloud className="h-8 w-8" />
                      </div>
                      <p className="mt-6 text-base font-semibold text-[#0F172A]">
                        Click to select or drag and drop
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        PDF, JPG or PNG only
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 rounded-[24px] border border-[#163B8C] bg-[#F8FBFF] p-4 shadow-sm">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#163B8C] text-white">
                        <FileText className="h-7 w-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#163B8C]">Selected file</p>
                        <p className="mt-1 truncate font-semibold text-[#0F172A]">{file.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {file.type || "application/octet-stream"} • {formatBytes(file.size)}
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} className="h-10 w-10 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </Button>
                    </div>
                  )}
                </div>

                {request.status === "UNDER_REVIEW" || request.status === "PENDING" || request.status === "ADDITIONAL_INFO_REQUIRED" ? (
                  <div className="rounded-[24px] border border-[#F6D365] bg-[#FFF9E8] p-4">
                    <p className="text-sm font-semibold text-[#8B5E00]">Waiting for officer review</p>
                    <p className="mt-1 text-sm leading-6 text-[#8B5E00]/80">
                      Your proof is attached to the current request. The officer will review it in the queue and update this case from the same workflow.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Supporting notes</label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Explain how the proof supports the request."
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={!canUpload || submitting}>
                    {submitting ? "Uploading..." : "Upload and continue"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/emergency/request">Back to request</Link>
                  </Button>
                </div>
                </form>
                )
              ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-[#163B8C]" />
                <p className="mt-4 text-base font-medium text-[#0F172A]">No request selected</p>
                <p className="mt-2 text-sm text-slate-500">Create or select a trigger request before attaching proof.</p>
                <Button asChild className="mt-5">
                  <Link href="/dashboard/emergency/request">Start request</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Uploaded files</CardTitle>
              <CardDescription>Previous proof items stay attached to the request.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {proofs.length ? (
                proofs.map((proof) => (
                  <div key={proof.id} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                    <FileText className="mt-0.5 h-5 w-5 text-[#163B8B]" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">{proof.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {proof.fileType} • {formatBytes(proof.fileSize)} • {formatDateTime(proof.createdAt)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{proof.notes ?? "No notes provided."}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                  No proof has been attached to this request yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Every state change is visible in the controlled workflow timeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeline.length ? (
                timeline.map((entry) => (
                  <div key={entry.id} className="flex gap-4 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                    <CheckCircle2 className="mt-1 h-5 w-5 text-[#163B8C]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[#0F172A]">{entry.action}</p>
                        <Badge variant={getTriggerStatusTone(entry.status)}>{triggerRequestStatusLabels[entry.status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{entry.summary}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {entry.actorRole} • {entry.actorName} • {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                  Timeline entries will appear as the request moves through the workflow.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#EEF4FF]">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-[#163B8C]" />
                <p className="text-sm font-medium text-[#0F172A]">Secure upload path</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                File uploads are constrained to approved formats and the backend will not accept a request without ownership checks.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function UploadProofPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading proof workflow...</div>}>
      <UploadProofContent />
    </Suspense>
  );
}
