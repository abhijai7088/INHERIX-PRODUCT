"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, FileCheck2, FileText, Inbox, ShieldCheck, TriangleAlert, XCircle, Download } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Textarea } from "@/components/inherix/textarea";
import { formatBytes, formatDateTime } from "@/lib/records";
import {
  approveTriggerRequest,
  getCurrentUser,
  getTriggerRequest,
  listTriggerRequests,
  rejectTriggerRequest,
  requestTriggerMoreInfo,
  verifyTriggerProof,
  getTriggerProofDownload,
  type TriggerDetail,
  type TriggerProof,
  type TriggerRequest,
} from "@/lib/trigger-api";
import {
  formatTriggerRequestKind,
  getTriggerPriorityTone,
  getTriggerStatusTone,
  getTriggerProofStatusTone,
  triggerProofStatusLabels,
  triggerRequestStatusLabels,
} from "@/lib/trigger-workflow";

export default function VerificationQueuePage() {
  const [allRequests, setAllRequests] = useState<TriggerRequest[]>([]);
  const [queue, setQueue] = useState<TriggerRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<TriggerDetail | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"document" | "proof" | null>(null);

  async function loadQueue(preferredRequestId?: string | null) {
    const list = await listTriggerRequests();
    setAllRequests(list.requests);
    const openRequests = list.requests.filter(
      (request) =>
        request.status === "PENDING" ||
        request.status === "UNDER_REVIEW" ||
        request.status === "ADDITIONAL_INFO_REQUIRED"
    );

    const orderedRequests = [...openRequests].sort((left, right) => {
      const leftFresh = left.proofCount > 0 ? 1 : 0;
      const rightFresh = right.proofCount > 0 ? 1 : 0;

      if (leftFresh !== rightFresh) {
        return rightFresh - leftFresh;
      }

      return right.latestActivityAt.localeCompare(left.latestActivityAt);
    });

    setQueue(orderedRequests);

    const preferredRequest =
      preferredRequestId && list.requests.some((request) => request.id === preferredRequestId)
        ? preferredRequestId
        : null;
    const chosenRequestId = preferredRequest ?? orderedRequests[0]?.id ?? null;
    if (chosenRequestId) {
      setSelectedRequest(await getTriggerRequest(chosenRequestId));
    } else {
      setSelectedRequest(null);
    }
  }

  async function refreshSelected(requestId?: string) {
    await loadQueue(requestId ?? selectedRequest?.request.id ?? null);
  }

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getCurrentUser();
        setRole(me.user.role);
        const requestId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("requestId");
        await loadQueue(requestId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the verification queue.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const stats = useMemo(
    () => ({
      queue: queue.length,
      underReview: queue.filter((request) => request.status === "UNDER_REVIEW").length,
      waitingInfo: queue.filter((request) => request.status === "ADDITIONAL_INFO_REQUIRED").length,
      approved: allRequests.filter((request) => request.status === "APPROVED").length,
      rejected: allRequests.filter((request) => request.status === "REJECTED").length,
      proofUploads: allRequests.reduce((total, request) => total + request.proofCount, 0),
      linkedDocuments: allRequests.filter((request) => request.documentId).length,
    }),
    [allRequests, queue]
  );
  const selectedLatestProof = selectedRequest?.proofs?.[0] ?? null;
  const selectedProofs = selectedRequest?.proofs ?? [];
  const selectedPendingProofs = selectedProofs.filter((proof) => proof.verificationStatus === "UPLOADED").length;
  const selectedVerifiedProofs = selectedProofs.filter((proof) => proof.verificationStatus === "VERIFIED").length;
  const selectedRejectedProofs = selectedProofs.filter((proof) => proof.verificationStatus === "REJECTED").length;
  const selectedRequestIsFinal =
    selectedRequest?.request.status === "APPROVED" ||
    selectedRequest?.request.status === "REJECTED" ||
    selectedRequest?.request.status === "CANCELLED";
  const canActOnSelectedRequest = Boolean(selectedRequest) && !selectedRequestIsFinal;
  const selectedRequiresAccessRule =
    selectedRequest?.request.requestKind === "document-access" && Boolean(selectedRequest.request.documentId);
  const selectedHasAccessRule = !selectedRequiresAccessRule || Boolean(selectedRequest?.request.accessRuleId);
  const canApproveSelectedRequest = canActOnSelectedRequest && selectedVerifiedProofs > 0 && selectedHasAccessRule;
  const decisionSummary = !selectedRequest
    ? {
        title: "No request selected",
        body: "Select a case from the queue or completed decisions to review its current state.",
        tone: "secondary" as const,
      }
    : selectedRequest.request.status === "APPROVED"
      ? {
          title: "Request approved",
          body: "This case is closed for verification. The release center controls nominee access to customer documents.",
          tone: "success" as const,
        }
      : selectedRequest.request.status === "REJECTED"
        ? {
            title: "Request rejected",
            body: selectedRequest.request.adminDecisionNote ?? "This case is closed after officer rejection.",
            tone: "destructive" as const,
          }
          : selectedRequiresAccessRule && !selectedHasAccessRule
            ? {
                title: "Customer rule missing",
                body: "The linked document no longer has an active customer access rule for this nominee, so approval is blocked.",
                tone: "destructive" as const,
              }
            : selectedPendingProofs > 0
          ? {
              title: "Proof review required",
              body: "Review the pending nominee proof before approving or rejecting the request.",
              tone: "warning" as const,
            }
          : selectedVerifiedProofs > 0
            ? {
                title: "Ready for request decision",
                body: "At least one proof is verified. You can approve, request more information, or reject the request.",
                tone: "success" as const,
              }
            : {
                title: "Waiting for usable proof",
                body: "No verified proof is available yet. Request more information or reject the request with remarks.",
                tone: "warning" as const,
              };
  const reviewStateItems = selectedRequest
    ? [
        `${selectedPendingProofs} pending proof, ${selectedVerifiedProofs} verified proof, ${selectedRejectedProofs} rejected proof.`,
        selectedRequest.request.status === "ADDITIONAL_INFO_REQUIRED"
          ? `More information requested: ${selectedRequest.request.additionalInfoReason ?? "Waiting for nominee response."}`
          : "No active more-information request on this case.",
        `Current request verdict: ${triggerRequestStatusLabels[selectedRequest.request.status]}.`,
        selectedRequiresAccessRule
          ? selectedHasAccessRule
            ? `Customer rule: ${selectedRequest.request.accessRuleScope?.toLowerCase() ?? "active"} rule, view ${
                selectedRequest.request.accessRuleCanView ? "allowed" : "blocked"
              }, download ${selectedRequest.request.accessRuleCanDownload ? "allowed" : "blocked"}.`
            : "Customer rule missing or inactive. Approval is blocked until the owner restores access."
          : "No document access rule is needed for this proof-only request.",
        selectedRequest.request.status === "APPROVED"
          ? "Controlled release is created from the customer rule after approval."
          : "Customer document access remains closed until the request is approved and released.",
      ]
    : [
        "Select a request to see proof review progress.",
        "More-information state will appear here when available.",
        "Request verdict will update after approve or reject.",
        "Release readiness appears only after approval.",
      ];
  const hasFreshProof =
    Boolean(selectedLatestProof) &&
    selectedPendingProofs > 0 &&
    (selectedRequest?.request.status === "PENDING" ||
      selectedRequest?.request.status === "UNDER_REVIEW" ||
      selectedRequest?.request.status === "ADDITIONAL_INFO_REQUIRED");
  const sortedQueue = useMemo(() => {
    return [...queue].sort((left, right) => {
      const leftFresh = left.proofCount > 0 ? 1 : 0;
      const rightFresh = right.proofCount > 0 ? 1 : 0;

      if (leftFresh !== rightFresh) {
        return rightFresh - leftFresh;
      }

      return right.latestActivityAt.localeCompare(left.latestActivityAt);
    });
  }, [queue]);
  const proofReadyRequests = useMemo(
    () =>
      allRequests.filter(
        (request) =>
          request.proofCount > 0 &&
          (request.status === "PENDING" ||
            request.status === "UNDER_REVIEW" ||
            request.status === "ADDITIONAL_INFO_REQUIRED")
      ),
    [allRequests]
  );
  const completedCases = useMemo(
    () =>
      allRequests
        .filter((request) => request.status === "APPROVED" || request.status === "REJECTED")
        .sort((left, right) => right.latestActivityAt.localeCompare(left.latestActivityAt)),
    [allRequests]
  );

  async function selectRequest(requestId: string) {
    try {
      setSelectedRequest(await getTriggerRequest(requestId));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the selected request.");
    }
  }

  async function handleProofAction(proof: TriggerProof, verificationStatus: "VERIFIED" | "REJECTED") {
    if (!selectedRequest) return;
    setWorking(`${proof.id}:${verificationStatus}`);
    setError(null);
    setMessage(null);

    try {
      await verifyTriggerProof({
        requestId: selectedRequest.request.id,
        proofId: proof.id,
        verificationStatus,
        adminRemarks: remarks || null,
      });
      await refreshSelected(selectedRequest.request.id);
      setRemarks("");
      
      if (verificationStatus === "VERIFIED") {
        setMessage("Proof verified! Don't forget to click 'Approve request' in the Decision Controls panel to finalize the document release.");
      } else {
        setMessage("Proof rejected.");
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to review the proof.");
    } finally {
      setWorking(null);
    }
  }

  async function handleViewProof(proof: TriggerProof) {
    if (!selectedRequest) return;
    setWorking(`view:${proof.id}`);
    setError(null);

    try {
      const result = await getTriggerProofDownload(selectedRequest.request.id, proof.id);
      setPreviewUrl(result.download.url);
      setPreviewType("proof");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to open the proof.");
    } finally {
      setWorking(null);
    }
  }



  async function handleRequestMoreInfo() {
    if (!selectedRequest) return;
    if (!remarks.trim()) {
      setError("Add a reason before requesting more information.");
      return;
    }

    setWorking("more-info");
    setError(null);
    setMessage(null);

    try {
      await requestTriggerMoreInfo(selectedRequest.request.id, remarks);
      await refreshSelected(selectedRequest.request.id);
      setRemarks("");
      setMessage("Requested more information from the nominee.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to request additional information.");
    } finally {
      setWorking(null);
    }
  }

  async function handleApprove() {
    if (!selectedRequest) return;
    setWorking("approve");
    setError(null);
    setMessage(null);

    try {
      await approveTriggerRequest(selectedRequest.request.id, remarks || null);
      await refreshSelected(selectedRequest.request.id);
      setRemarks("");
      setMessage("Request successfully approved! The document has been released to the nominee.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to approve the trigger request.");
    } finally {
      setWorking(null);
    }
  }

  async function handleReject() {
    if (!selectedRequest) return;
    setWorking("reject");
    setError(null);
    setMessage(null);

    try {
      await rejectTriggerRequest(selectedRequest.request.id, remarks || null);
      await refreshSelected(selectedRequest.request.id);
      setRemarks("");
      setMessage("Request successfully rejected.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to reject the trigger request.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Verification queue</Badge>
              <Badge variant="secondary">Audited decisions</Badge>
              <Badge variant="secondary">Controlled release gate</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">Emergency proof review</p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Review proof, request more information, and approve only verified trigger cases.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                Proof decisions are separate from release decisions, and every action is written to the audit trail.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Queue</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : stats.queue}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Under review</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : stats.underReview}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Needs info</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : stats.waitingInfo}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Approved</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : stats.approved}</p>
              </div>
            </div>

            {!loading && stats.queue > 0 ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">New proof received in the review queue</p>
                    <p className="mt-1 text-sm leading-6 text-amber-900/80">
                      Open the latest case to review the nominee submission, inspect the customer context, and continue the approval path.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected case state</CardTitle>
            <CardDescription>Live proof, more-info, verdict, and release readiness for the current request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviewStateItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {message ? (
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardContent className="p-5 text-sm font-medium text-green-700">{message}</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <CardTitle>Nominee Proof Preview</CardTitle>
                <CardDescription>
                  Review the uploaded evidence from the nominee.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(null)}>
                <XCircle className="h-6 w-6" />
              </Button>
            </CardHeader>
            <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-[500px]">
              <div className="md:w-80 border-r border-slate-100 bg-white p-6 overflow-y-auto shrink-0 flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Context</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Customer</p>
                      <p className="text-sm font-medium text-[#0F172A]">{selectedRequest?.request.customerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Nominee</p>
                      <p className="text-sm font-medium text-[#0F172A]">{selectedRequest?.request.nomineeName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Subject</p>
                      <p className="text-sm font-medium text-[#0F172A]">{selectedRequest?.request.subjectLine}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Proof Details</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Uploaded</p>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {formatDateTime(selectedProofs[0]?.createdAt ?? selectedRequest?.request.latestActivityAt ?? new Date().toISOString())}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Notes from Nominee</p>
                      <p className="text-sm text-slate-600 mt-1 p-2 bg-slate-50 rounded-md border border-slate-100">
                        {selectedProofs[0]?.notes || "No notes provided."}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedRequest?.request.documentId && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Customer Rule</h3>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-xs text-slate-500">Linked Document</p>
                        <p className="text-sm font-medium text-[#0F172A]">{selectedRequest?.request.documentTitle ?? "Customer document"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Access Limits</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant={selectedRequest.request.accessRuleCanView ? "success" : "secondary"} className="text-[10px]">
                            {selectedRequest.request.accessRuleCanView ? "View" : "No View"}
                          </Badge>
                          <Badge variant={selectedRequest.request.accessRuleCanDownload ? "success" : "secondary"} className="text-[10px]">
                            {selectedRequest.request.accessRuleCanDownload ? "Download" : "No Download"}
                          </Badge>
                        </div>
                      </div>
                      {selectedRequest.request.accessRuleCondition && (
                        <div>
                          <p className="text-xs text-slate-500">Condition</p>
                          <p className="text-sm text-slate-600 leading-tight mt-1">{selectedRequest.request.accessRuleCondition}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-slate-50 relative min-h-[400px] flex items-center justify-center">
                {selectedProofs[0]?.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={previewUrl}
                    alt={selectedProofs[0]?.fileName ?? "Document"}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : selectedProofs[0]?.fileName?.match(/\.(pdf)$/i) ? (
                  <iframe 
                    src={previewUrl} 
                    className="absolute inset-0 w-full h-full border-0"
                    title="Document Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <FileText className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-lg font-medium text-slate-900 mb-2">Preview not available</p>
                    <p className="text-sm text-slate-500 max-w-sm mb-6">
                      This file type ({selectedProofs[0]?.fileName?.split('.').pop()?.toUpperCase() ?? 'Unknown'}) cannot be previewed directly in the browser.
                    </p>
                    <Button asChild>
                      <a href={previewUrl} download={selectedProofs[0]?.fileName ?? "document"}>
                        <Download className="mr-2 h-4 w-4" />
                        Download to view
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Proof uploads",
            value: stats.proofUploads,
            description: "Nominee files attached across live cases.",
            icon: FileText,
          },
          {
            title: "Ready for review",
            value: proofReadyRequests.length,
            description: "Open requests with nominee evidence waiting.",
            icon: FileCheck2,
          },
          {
            title: "Linked documents",
            value: stats.linkedDocuments,
            description: "Cases tied to a customer document.",
            icon: Eye,
          },
          {
            title: "Rejected",
            value: stats.rejected,
            description: "Closed requests rejected after review.",
            icon: XCircle,
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-2xl bg-[#EEF4FF] p-3 text-[#163B8C]">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{item.title}</p>
                <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : item.value}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Active verification queue</CardTitle>
            <CardDescription>Live requests that still need officer action.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedQueue.length ? (
              sortedQueue.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => void selectRequest(request.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    selectedRequest?.request.id === request.id
                      ? "border-[#163B8C] bg-[#F8FBFF]"
                      : "border-[#DCE3EC] bg-white hover:border-[#163B8C]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#0F172A]">{request.subjectLine}</p>
                        <Badge variant={getTriggerStatusTone(request.status)}>{triggerRequestStatusLabels[request.status]}</Badge>
                        {request.proofCount > 0 ? <Badge variant="destructive">New proof</Badge> : null}
                        {request.proofCount > 0 ? <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.15)]" /> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {request.customerName} - {request.nomineeName} - {formatTriggerRequestKind(request.requestKind)} - {formatDateTime(request.latestActivityAt)}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                There are no pending requests in the queue right now.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request details</CardTitle>
            <CardDescription>Inspect the selected request, its proof, and the timeline entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedRequest ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getTriggerStatusTone(selectedRequest.request.status)}>{triggerRequestStatusLabels[selectedRequest.request.status]}</Badge>
                  <Badge variant={getTriggerPriorityTone(selectedRequest.request.priority)}>{selectedRequest.request.priority}</Badge>
                  <Badge variant="secondary">{formatTriggerRequestKind(selectedRequest.request.requestKind)}</Badge>
                  {role ? <Badge variant="secondary">{role}</Badge> : null}
                </div>

                <div className="space-y-3 rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-5">
                  <h2 className="text-2xl font-semibold text-[#0F172A]">{selectedRequest.request.subjectLine}</h2>
                  <p className="text-sm leading-7 text-slate-500">{selectedRequest.request.summary}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] bg-white p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Customer</p>
                      <p className="mt-2 font-semibold text-[#0F172A]">{selectedRequest.request.customerName}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedRequest.request.customerId}</p>
                    </div>
                    <div className="rounded-[20px] bg-white p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Nominee</p>
                      <p className="mt-2 font-semibold text-[#0F172A]">{selectedRequest.request.nomineeName}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedRequest.request.nomineeEmail ?? "No email on file"}</p>
                    </div>
                    {selectedRequest.request.documentId ? (
                      <div className="rounded-[20px] bg-white p-4 sm:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Linked customer document</p>
                        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0F172A]">{selectedRequest.request.documentTitle ?? "Customer document"}</p>
                            <p className="mt-1 text-sm text-slate-500">{selectedRequest.request.documentId}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#0F172A]">Customer-defined access rule</p>
                            {selectedRequest.request.accessRuleId ? (
                              <Badge variant="success">{selectedRequest.request.accessRuleScope ?? "ACTIVE"} rule</Badge>
                            ) : (
                              <Badge variant="destructive">Missing rule</Badge>
                            )}
                          </div>
                          {selectedRequest.request.accessRuleId ? (
                            <>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant={selectedRequest.request.accessRuleCanView ? "success" : "secondary"}>
                                  {selectedRequest.request.accessRuleCanView ? "View allowed" : "View blocked"}
                                </Badge>
                                <Badge variant={selectedRequest.request.accessRuleCanDownload ? "success" : "secondary"}>
                                  {selectedRequest.request.accessRuleCanDownload ? "Download allowed" : "Download blocked"}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {selectedRequest.request.accessRuleCondition ?? "Release follows the active customer rule."}
                                {selectedRequest.request.accessRuleNotes ? ` ${selectedRequest.request.accessRuleNotes}` : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">Rule {selectedRequest.request.accessRuleId}</p>
                            </>
                          ) : (
                            <p className="mt-2 text-sm leading-6 text-red-700">
                              This document request cannot be approved until the customer has an active rule for this nominee and document.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[20px] bg-white p-4 sm:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Linked customer document</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          This request is proof-only, so the officer queue will continue to show the uploaded proof cards instead of a linked customer document.
                        </p>
                      </div>
                    )}
                    <div className="rounded-[20px] bg-white p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Evidence state</p>
                      <p className="mt-2 font-semibold text-[#0F172A]">{formatDateTime(selectedRequest.request.latestActivityAt)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedProofs.length} proof item{selectedProofs.length === 1 ? "" : "s"} - {selectedPendingProofs} pending - {selectedVerifiedProofs} verified - {selectedRejectedProofs} rejected
                      </p>
                    </div>
                  </div>
                </div>

                {hasFreshProof ? (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Proof uploaded and waiting review</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                          The nominee case from {selectedRequest.request.customerName} is ready for proof review. Verify the latest attachment before approving the request.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedRequest.request.status === "ADDITIONAL_INFO_REQUIRED" ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-700" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Additional information required</p>
                        <p className="mt-1 text-sm leading-6 text-amber-900/80">
                          {selectedRequest.request.additionalInfoReason ?? "Review is paused until the required information is attached."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <label className="text-sm font-medium text-[#0F172A]">Admin remarks</label>
                  <Textarea
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    rows={4}
                    placeholder="Add a review note, more-info request, or approval note."
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center">
                <Inbox className="mx-auto h-10 w-10 text-[#163B8C]" />
                <p className="mt-4 text-base font-medium text-[#0F172A]">Nothing selected</p>
                <p className="mt-2 text-sm text-slate-500">Pick a request from the queue to inspect the proof trail.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nominee proof evidence</CardTitle>
            <CardDescription>These are the actual files uploaded by the nominee for the selected request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRequest ? (
              <>
                {selectedRequest.proofs.length ? (
                  selectedRequest.proofs.map((proof) => (
                    <div key={proof.id} className="space-y-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-[#0F172A]">Nominee uploaded: {proof.fileName}</p>
                            <Badge variant={getTriggerProofStatusTone(proof.verificationStatus)}>
                              {triggerProofStatusLabels[proof.verificationStatus]}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {proof.fileType} - {formatBytes(proof.fileSize)} - {formatDateTime(proof.createdAt)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{proof.notes ?? "No notes provided."}</p>
                          <p className="mt-2 text-xs text-slate-500">Uploaded by: {proof.uploadedBy ?? "Unknown"} ({proof.uploadedByRole})</p>
                          {proof.adminRemarks ? <p className="mt-2 text-xs text-slate-400">Reviewer note: {proof.adminRemarks}</p> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => void handleProofAction(proof, "VERIFIED")}
                          disabled={working !== null || !canActOnSelectedRequest || proof.verificationStatus !== "UPLOADED"}
                        >
                          {proof.verificationStatus === "VERIFIED" ? "Proof verified" : "Verify proof"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleProofAction(proof, "REJECTED")}
                          disabled={working !== null || !canActOnSelectedRequest || proof.verificationStatus !== "UPLOADED"}
                        >
                          {proof.verificationStatus === "REJECTED" ? "Proof rejected" : "Reject proof"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => void handleViewProof(proof)} disabled={working !== null}>
                          Open nominee proof
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                    No proof files have been attached yet.
                  </div>
                )}

                <div className="space-y-3 rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                  <p className="text-sm font-semibold text-[#0F172A]">Timeline</p>
                  {selectedRequest.timeline.length ? (
                    selectedRequest.timeline.map((entry) => (
                      <div key={entry.id} className="rounded-[20px] border border-white bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[#0F172A]">{entry.action}</p>
                          <Badge variant={getTriggerStatusTone(entry.status)}>{triggerRequestStatusLabels[entry.status]}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{entry.summary}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {entry.actorRole} - {entry.actorName} - {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No timeline entries yet.</p>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-[#EEF4FF]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
              <p className="text-sm font-medium text-[#0F172A]">Decision controls</p>
            </div>
            <div className="rounded-[22px] border border-[#DCE3EC] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#0F172A]">{decisionSummary.title}</p>
                <Badge variant={decisionSummary.tone}>
                  {selectedRequest ? triggerRequestStatusLabels[selectedRequest.request.status] : "No case"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{decisionSummary.body}</p>
              {selectedRequest ? (
                <p className="mt-2 text-xs text-slate-500">
                  Proofs: {selectedPendingProofs} pending, {selectedVerifiedProofs} verified, {selectedRejectedProofs} rejected.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleRequestMoreInfo()} disabled={working !== null || !canActOnSelectedRequest}>
                Request more info
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleApprove()} disabled={working !== null || !canApproveSelectedRequest}>
                Approve request
              </Button>
              <Button type="button" variant="destructive" onClick={() => void handleReject()} disabled={working !== null || !canActOnSelectedRequest}>
                Reject request
              </Button>
            </div>
            {canActOnSelectedRequest && !canApproveSelectedRequest ? (
              <p className="text-xs text-amber-700">
                Approve unlocks only after at least one nominee proof is verified and the linked customer rule is active.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Approval creates or refreshes the controlled release for the exact linked document using the customer rule.
              </p>
            )}
            {selectedRequest?.request.status === "APPROVED" ? (
              <div className="rounded-[22px] border border-[#C7D2FE] bg-white p-4">
                <p className="text-sm font-semibold text-[#0F172A]">Approved case has controlled release</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  The trigger request has cleared the proof review gate. The nominee document release is created from the customer rule.
                </p>
                <Button asChild className="mt-4">
                  <Link href={`/dashboard/releases?requestId=${encodeURIComponent(selectedRequest.request.id)}`}>Open release center</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Completed decisions</CardTitle>
            <CardDescription>Approved and rejected requests remain visible after refresh.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedCases.length ? (
              completedCases.slice(0, 8).map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => void selectRequest(request.id)}
                  className="w-full rounded-[24px] border border-[#DCE3EC] bg-white p-4 text-left transition hover:border-[#163B8C]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#0F172A]">{request.subjectLine}</p>
                        <Badge variant={getTriggerStatusTone(request.status)}>{triggerRequestStatusLabels[request.status]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {request.customerName} - {request.nomineeName} - {request.proofCount} proof item{request.proofCount === 1 ? "" : "s"} - {formatDateTime(request.latestActivityAt)}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                Approved or rejected cases will appear here as soon as an officer makes a final decision.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proof-ready cases</CardTitle>
            <CardDescription>Quick access to requests where nominee evidence exists.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {proofReadyRequests.length ? (
              proofReadyRequests.slice(0, 6).map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => void selectRequest(request.id)}
                  className="w-full rounded-[22px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-left transition hover:border-[#163B8C] hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getTriggerStatusTone(request.status)}>{triggerRequestStatusLabels[request.status]}</Badge>
                    {request.documentId ? <Badge variant="secondary">Linked document</Badge> : <Badge variant="secondary">Proof-only</Badge>}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{request.subjectLine}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.proofCount} nominee proof item{request.proofCount === 1 ? "" : "s"} - {formatDateTime(request.latestActivityAt)}
                  </p>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500">
                No nominee proof uploads are waiting right now.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
