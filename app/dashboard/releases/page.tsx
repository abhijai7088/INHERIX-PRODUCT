"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, History, Lock, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Textarea } from "@/components/inherix/textarea";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { formatBytes, formatDateTime, formatRelationship, type RelationshipOption } from "@/lib/records";
import {
  createOrUpdateRelease,
  getReleaseQueueRequest,
  listReleaseQueue,
  revokeRelease,
  type ReleaseDocumentCandidate,
  type ReleaseNotification,
  type ReleaseQueueSummary,
  type ReleaseRecord,
  type ReleaseRequestRecord,
} from "@/lib/release-api";

export default function ReleaseCenterPage() {
  const authHelpText = "Sign in to view the release center.";
  const router = useRouter();
  const [queue, setQueue] = useState<ReleaseQueueSummary[]>([]);
  const [notifications, setNotifications] = useState<ReleaseNotification[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ReleaseRequestRecord | null>(null);
  const [documents, setDocuments] = useState<ReleaseDocumentCandidate[]>([]);
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [viewAllowed, setViewAllowed] = useState(true);
  const [downloadAllowed, setDownloadAllowed] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function loadQueue(preferredRequestId?: string | null) {
    const payload = await listReleaseQueue();
    setQueue(payload.requests);
    setNotifications(payload.notifications);

    const fallbackRequestId = preferredRequestId ?? payload.requests[0]?.request.id ?? null;
    if (!fallbackRequestId) {
      setSelectedRequest(null);
      setDocuments([]);
      setReleases([]);
      setSelectedDocumentId("");
      return;
    }

    const detail = await getReleaseQueueRequest(fallbackRequestId);
    setSelectedRequest(detail.request);
    setDocuments(detail.documents);
    setReleases(detail.releases);

    const nextDocumentId = detail.documents[0]?.documentId ?? "";
    setSelectedDocumentId(nextDocumentId);
    setViewAllowed(detail.documents[0]?.canView ?? true);
    setDownloadAllowed(detail.documents[0]?.canDownload ?? false);
    setReleaseNotes(detail.documents[0]?.releaseNotes ?? detail.documents[0]?.conditionNotes ?? "");
  }

  useEffect(() => {
    const load = async () => {
      try {
        const requestId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("requestId");
        await loadQueue(requestId);
      } catch (loadError) {
        setError(isAuthenticationError(loadError) ? authHelpText : getErrorMessage(loadError, "Unable to load the release center."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.documentId === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const releaseCounts = useMemo(
    () => ({
      approved: queue.length,
      eligible: documents.length,
      released: releases.filter((item) => item.releaseStatus === "RELEASED").length,
      revoked: releases.filter((item) => item.releaseStatus === "REVOKED").length,
    }),
    [documents.length, queue.length, releases]
  );

  async function selectRequest(requestId: string) {
    try {
      const detail = await getReleaseQueueRequest(requestId);
      setSelectedRequest(detail.request);
      setDocuments(detail.documents);
      setReleases(detail.releases);
      const nextDocumentId = detail.documents[0]?.documentId ?? "";
      setSelectedDocumentId(nextDocumentId);
      setViewAllowed(detail.documents[0]?.canView ?? true);
      setDownloadAllowed(detail.documents[0]?.canDownload ?? false);
      setReleaseNotes(detail.documents[0]?.releaseNotes ?? detail.documents[0]?.conditionNotes ?? "");
      router.replace(`/dashboard/releases?requestId=${encodeURIComponent(requestId)}`, { scroll: false });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the selected release case.");
    }
  }

  async function handleSave() {
    if (!selectedRequest || !selectedDocument) {
      setError("Choose an approved request and eligible document first.");
      return;
    }

    setWorking(true);
    setError(null);

    try {
      await createOrUpdateRelease({
        triggerRequestId: selectedRequest.id,
        documentId: selectedDocument.documentId,
        canView: viewAllowed,
        canDownload: downloadAllowed,
        releaseNotes,
      });
      setMessage(`Release configured for ${selectedDocument.documentTitle}.`);
      await loadQueue(selectedRequest.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update the release.");
    } finally {
      setWorking(false);
    }
  }

  async function handleRevoke(releaseId: string) {
    setWorking(true);
    setError(null);

    try {
      await revokeRelease(releaseId, "Revoked from the controlled release center.");
      setMessage("Release revoked.");
      await loadQueue(selectedRequest?.id ?? null);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke the release.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Release Center</Badge>
              <Badge variant="secondary">Selective release</Badge>
              <Badge variant="secondary">Audit logged</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">Controlled document release</p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Release only the documents that are approved and eligible.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                This is not vault browsing. It is a selective release workflow tied to approved trigger cases, owner access rules, and document-by-document permissions.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Approved cases</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : releaseCounts.approved}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Eligible docs</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : releaseCounts.eligible}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Released</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : releaseCounts.released}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Revoked</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "…" : releaseCounts.revoked}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Release rules</CardTitle>
            <CardDescription>Only approved trigger cases and mapped documents appear here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Owner-defined access rules control the eligible document list.",
              "Release permission is stored as a separate release record.",
              "View and download are checked again before every access token.",
              "Revocation immediately removes the active release posture.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
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
              The release center is tied to your signed-in account and role. Sign back in to continue managing release records.
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
              Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to `backend/.env`, then restart the backend so released-document previews and downloads can be signed.
            </p>
          </CardContent>
        </Card>
      ) : error?.includes("S3_BUCKET_NAME, AWS_REGION, and AWS_KMS_KEY_ID") ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-amber-900">Storage configuration is incomplete.</p>
            <p className="text-sm leading-6 text-amber-800/90">
              Add the bucket name, AWS region, and KMS key ID before the release center can issue live storage URLs.
            </p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {message ? (
        <Card className="border-[#C7E3D1] bg-[#F2FBF5]">
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{message}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Approved trigger cases</CardTitle>
            <CardDescription>Select a verified case to see only its eligible release documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.length ? (
              queue.map((item) => (
                <button
                  key={item.request.id}
                  type="button"
                  onClick={() => void selectRequest(item.request.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    selectedRequest?.id === item.request.id
                      ? "border-[#163B8C] bg-[#F8FBFF]"
                      : "border-[#DCE3EC] bg-white hover:border-[#163B8C]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A]">{item.request.subjectLine}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.request.nomineeName} • {formatRelationship(item.request.relationship as RelationshipOption, item.request.customRelationship ?? undefined)} • {formatDateTime(item.request.updatedAt)}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                No approved trigger cases are available for release.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eligible document release</CardTitle>
            <CardDescription>Choose a mapped document and set release permissions for the nominee.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRequest ? (
              <>
                <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Approved trigger</Badge>
                    <Badge variant="secondary">{selectedRequest.requestKind}</Badge>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-[#0F172A]">{selectedRequest.subjectLine}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{selectedRequest.summary}</p>
                  <p className="mt-3 text-sm text-slate-500">
                    {selectedRequest.nomineeName} • {formatRelationship(selectedRequest.relationship as RelationshipOption, selectedRequest.customRelationship ?? undefined)}
                  </p>
                </div>

                <div className="space-y-3">
                  {documents.length ? (
                    documents.map((item) => {
                      const existingRelease = releases.find((release) => release.documentId === item.documentId);
                      return (
                        <button
                          key={item.documentId}
                          type="button"
                          onClick={() => {
                            setSelectedDocumentId(item.documentId);
                            setViewAllowed(item.canView);
                            setDownloadAllowed(item.canDownload);
                            setReleaseNotes(item.releaseNotes ?? item.conditionNotes ?? "");
                          }}
                          className={`w-full rounded-[24px] border p-4 text-left transition ${
                            selectedDocument?.documentId === item.documentId
                              ? "border-[#163B8C] bg-[#F8FBFF]"
                              : "border-[#DCE3EC] bg-white hover:border-[#163B8C]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[#0F172A]">{item.documentTitle}</p>
                                <Badge variant={existingRelease ? "success" : "default"}>
                                  {existingRelease ? existingRelease.releaseStatus : "Ready"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.fileName ?? "Encrypted file"} • {formatBytes(item.fileSize ?? 0)} • {item.canView ? "view" : "no view"} / {item.canDownload ? "download" : "no download"}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{item.releaseNotes ?? item.conditionNotes ?? "Ready for controlled release."}</p>
                            </div>
                            <FileText className="mt-1 h-5 w-5 text-[#163B8B]" />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                      No eligible documents are mapped to this approved case.
                    </div>
                  )}
                </div>

                {selectedDocument ? (
                  <div className="space-y-4 rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{selectedDocument.categoryName}</Badge>
                      <Badge variant="secondary">{selectedDocument.releaseStatus}</Badge>
                    </div>
                    <h3 className="text-xl font-semibold text-[#0F172A]">{selectedDocument.documentTitle}</h3>
                    <p className="text-sm leading-7 text-slate-500">{selectedDocument.conditionNotes ?? "Release permission is derived from the selected access rule."}</p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center justify-between rounded-[22px] border border-[#DCE3EC] bg-white p-4 text-sm">
                        Allow view
                        <input
                          type="checkbox"
                          checked={viewAllowed}
                          onChange={(event) => setViewAllowed(event.target.checked)}
                          className="h-5 w-5"
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-[22px] border border-[#DCE3EC] bg-white p-4 text-sm">
                        Allow download
                        <input
                          type="checkbox"
                          checked={downloadAllowed}
                          onChange={(event) => setDownloadAllowed(event.target.checked)}
                          className="h-5 w-5"
                        />
                      </label>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[#0F172A]">Release notes</p>
                      <Textarea value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} rows={4} />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button type="button" onClick={() => void handleSave()} disabled={working}>
                        <CheckCircle2 className="h-4 w-4" />
                        {releases.find((release) => release.documentId === selectedDocument.documentId) ? "Update release" : "Release document"}
                      </Button>
                      {releases.find((release) => release.documentId === selectedDocument.documentId && release.releaseStatus !== "REVOKED") ? (
                        <Button type="button" variant="destructive" onClick={() => void handleRevoke(releases.find((release) => release.documentId === selectedDocument.documentId)!.id)} disabled={working}>
                          <Trash2 className="h-4 w-4" />
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center">
                <Lock className="mx-auto h-10 w-10 text-[#163B8B]" />
                <p className="mt-4 text-base font-medium text-[#0F172A]">No approved release case selected</p>
                <p className="mt-2 text-sm text-slate-500">Select an approved trigger case to configure a controlled release.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent release notifications</CardTitle>
            <CardDescription>Nominee and admin alerts stay visible alongside the release center.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.slice(0, 4).map((notification) => (
              <div key={notification.id} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{notification.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{notification.message}</p>
                  </div>
                  <Badge variant={notification.readAt ? "secondary" : "warning"}>{notification.readAt ? "Read" : "Unread"}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">{formatDateTime(notification.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[#EEF4FF]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-[#163B8B]" />
              <p className="text-sm font-medium text-[#0F172A]">Separate release record</p>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Release permissions are stored independently from the original vault and can be updated or revoked without changing ownership.
            </p>
            <Button asChild variant="outline">
              <a href="/dashboard/releases/history">Open release history</a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
