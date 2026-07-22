"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, FileText, RefreshCw, ShieldCheck, XCircle, Eye, Send } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Textarea } from "@/components/inherix/textarea";
import { formatDateTime } from "@/lib/records";
import {
  listSuperAdminApprovalQueue,
  superAdminApproveTriggerRequest,
  superAdminRejectTriggerRequest,
  getTriggerRequest,
  getTriggerProofDownload,
  type TriggerRequest,
  type TriggerDetail,
  type TriggerProof,
} from "@/lib/trigger-api";
import {
  formatTriggerRequestKind,
  getTriggerPriorityTone,
  triggerRequestStatusLabels,
} from "@/lib/trigger-workflow";

export default function SuperAdminApprovalsPage() {
  const [queue, setQueue] = useState<TriggerRequest[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<TriggerDetail | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "doc" | null>(null);

  async function loadQueue(selectId?: string | null) {
    const data = await listSuperAdminApprovalQueue();
    setQueue(data.requests);
    const chooseId = selectId ?? data.requests[0]?.id ?? null;
    if (chooseId) {
      const detail = await getTriggerRequest(chooseId);
      setSelectedDetail(detail);
    } else {
      setSelectedDetail(null);
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        await loadQueue();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load the approval queue.");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  async function handleApprove() {
    if (!selectedDetail) return;
    setWorking("approve");
    setError(null);
    setMessage(null);
    try {
      await superAdminApproveTriggerRequest(selectedDetail.request.id, remarks || null);
      await loadQueue();
      setRemarks("");
      setMessage("Request approved. Documents have been released to the nominee.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to approve this request.");
    } finally {
      setWorking(null);
    }
  }

  async function handleReject() {
    if (!selectedDetail) return;
    setWorking("reject");
    setError(null);
    setMessage(null);
    try {
      await superAdminRejectTriggerRequest(selectedDetail.request.id, remarks || null);
      await loadQueue();
      setRemarks("");
      setMessage("Request rejected. The nominee will be notified.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reject this request.");
    } finally {
      setWorking(null);
    }
  }

  async function handlePreviewProof(proof: TriggerProof) {
    if (!selectedDetail) return;
    try {
      const res = await getTriggerProofDownload(selectedDetail.request.id, proof.id);
      const url = res.download?.url ?? null;
      if (!url) return;
      setPreviewUrl(url);
      setPreviewFileName(proof.fileName);
      const mime = proof.fileType.toLowerCase();
      if (mime.includes("pdf")) setPreviewType("pdf");
      else if (mime.startsWith("image/")) setPreviewType("image");
      else setPreviewType("doc");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load proof preview.");
    }
  }

  function closePreview() {
    setPreviewUrl(null);
    setPreviewFileName(null);
    setPreviewType(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm font-medium">Loading approval queue…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-200">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Final Approval Queue</h1>
            <p className="text-sm text-slate-500">Super Admin · Decentralized release gate</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {queue.length} pending
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadQueue(selectedDetail?.request.id)}
            disabled={working !== null}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      {/* Proof Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <span className="text-sm font-semibold text-slate-800">{previewFileName ?? "Document Preview"}</span>
              <button onClick={closePreview} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
                <XCircle className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50" style={{ minHeight: "60vh" }}>
              {previewType === "pdf" && (
                <iframe src={previewUrl} className="h-[70vh] w-full border-0" title="Proof PDF" />
              )}
              {previewType === "image" && (
                <img src={previewUrl} alt={previewFileName ?? "Proof"} className="mx-auto max-h-[70vh] object-contain p-4" />
              )}
              {previewType === "doc" && (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
                  <FileText className="h-16 w-16 text-slate-300" />
                  <p className="text-sm">This file type cannot be previewed inline.</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {queue.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed border-2 border-slate-200 bg-white">
          <CheckCircle2 className="mb-4 h-12 w-12 text-green-400" />
          <h2 className="text-lg font-semibold text-slate-700">All clear — no pending approvals</h2>
          <p className="mt-1 text-sm text-slate-500">Every request that has passed verification has been resolved.</p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          {/* Queue Panel */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Pending Requests ({queue.length})
            </h2>
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {queue.map((req) => (
                <button
                  key={req.id}
                  onClick={() => {
                    void (async () => {
                      try {
                        setSelectedDetail(await getTriggerRequest(req.id));
                        setError(null);
                        setMessage(null);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Unable to load request details.");
                      }
                    })();
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all hover:shadow-md focus:outline-none ${
                    selectedDetail?.request.id === req.id
                      ? "border-violet-400 bg-violet-50 shadow-sm ring-1 ring-violet-300"
                      : "border-slate-200 bg-white hover:border-violet-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{req.subjectLine}</span>
                    <Badge variant={getTriggerPriorityTone(req.priority)} className="shrink-0 text-[10px]">
                      {req.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">{req.nomineeName} · {formatTriggerRequestKind(req.requestKind)}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{formatDateTime(req.latestActivityAt)}</span>
                    <span>·</span>
                    <span>{req.proofCount} proof{req.proofCount !== 1 ? "s" : ""}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedDetail ? (
            <div className="space-y-4">
              {/* Request Overview */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base leading-snug">{selectedDetail.request.subjectLine}</CardTitle>
                      <CardDescription className="text-xs">
                        {selectedDetail.request.nomineeName} · {formatTriggerRequestKind(selectedDetail.request.requestKind)}
                      </CardDescription>
                    </div>
                    <Badge variant="warning" className="shrink-0 text-[11px]">
                      {triggerRequestStatusLabels["PENDING_SUPER_ADMIN_APPROVAL"]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedDetail.request.summary}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span><strong className="text-slate-700">Customer:</strong> {selectedDetail.request.customerName}</span>
                    <span><strong className="text-slate-700">Document:</strong> {selectedDetail.request.documentTitle ?? "—"}</span>
                    <span><strong className="text-slate-700">Submitted:</strong> {selectedDetail.request.submittedAt ? formatDateTime(selectedDetail.request.submittedAt) : "—"}</span>
                    <span><strong className="text-slate-700">VO Remarks:</strong> {selectedDetail.request.adminDecisionNote ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Proof Viewer */}
              {selectedDetail.proofs.length > 0 && (
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Nominee Proofs ({selectedDetail.proofs.length})</CardTitle>
                    <CardDescription className="text-xs">Review each uploaded document before making a final decision.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedDetail.proofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-violet-500" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-800">{proof.fileName}</p>
                            <p className="text-[10px] text-slate-400">{proof.fileType} · {formatDateTime(proof.createdAt)}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 shrink-0 h-7 text-[11px] px-2.5"
                          onClick={() => void handlePreviewProof(proof)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Decision Controls */}
              <Card className="border-violet-100 bg-gradient-to-br from-white to-violet-50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-violet-600" />
                    Final Decision
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Your approval will immediately release the document to the nominee. This action is logged and irreversible.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Optional: add a decision note or remarks for the audit log…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                    disabled={working !== null}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void handleApprove()}
                      disabled={working !== null}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 transition-all"
                    >
                      {working === "approve" ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Approve & Release Documents
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleReject()}
                      disabled={working !== null}
                    >
                      {working === "reject" ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject Request
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Approving will create a controlled document release. Rejecting will notify the nominee and customer that access was denied.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed border-2 border-slate-200 bg-white">
              <Send className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">Select a request from the queue to review and decide.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
