"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Lock, ShieldCheck, UploadCloud } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { inferAccountRole, getAccountLabel, type AccountRole } from "@/lib/account";
import { formatBytes, formatDateTime } from "@/lib/records";
import { loadCurrentNominee, type NomineeApiRecord } from "@/lib/nominees";
import {
  createTriggerRequest,
  getCurrentUser,
  getTriggerRequest,
  listEligibleDocumentRequests,
  submitTriggerRequest,
  type TriggerRequest,
  type TriggerEligibleDocument,
  type TriggerRequestPriority,
} from "@/lib/trigger-api";
import { triggerRequestPriorities } from "@/lib/trigger-workflow";

function getRequestBadgeVariant(status: TriggerEligibleDocument["requestStatus"]) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED" || status === "CANCELLED") return "destructive";
  if (status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED" || status === "PENDING") return "warning";
  return "secondary";
}

function getReleaseBadgeVariant(status: TriggerEligibleDocument["releaseStatus"]) {
  if (status === "RELEASED") return "success";
  if (status === "REVOKED") return "destructive";
  if (status === "PENDING") return "warning";
  return "secondary";
}

function getRequestLabel(status: TriggerEligibleDocument["requestStatus"]) {
  if (!status) return "Not requested";
  return status.replaceAll("_", " ").toLowerCase();
}

function getReleaseLabel(status: TriggerEligibleDocument["releaseStatus"]) {
  if (!status) return "Not released";
  return status.toLowerCase();
}

function isActiveRequestStatus(status: TriggerEligibleDocument["requestStatus"] | TriggerRequest["status"] | null | undefined) {
  return status === "PENDING" || status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED";
}

function isApprovedRequestStatus(status: TriggerEligibleDocument["requestStatus"] | TriggerRequest["status"] | null | undefined) {
  return status === "APPROVED";
}

function getDocumentAction(document: TriggerEligibleDocument) {
  if (document.releaseStatus === "RELEASED") {
    return {
      label: "Open approved access",
      href: "/dashboard/released-documents#released-documents",
      tone: "primary" as const,
      disabled: false,
    };
  }

  if (isApprovedRequestStatus(document.requestStatus)) {
    return {
      label: "Waiting for release",
      href: `/dashboard/released-documents/request?documentId=${encodeURIComponent(document.documentId)}`,
      tone: "secondary" as const,
      disabled: true,
    };
  }

  if (isActiveRequestStatus(document.requestStatus) && document.requestId) {
    return {
      label: document.requestStatus === "ADDITIONAL_INFO_REQUIRED" ? "Upload more proof" : "Continue proof",
      href: `/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(document.requestId)}`,
      tone: "primary" as const,
      disabled: false,
    };
  }

  return {
    label: document.requestStatus === "REJECTED" || document.releaseStatus === "REVOKED" ? "Request again" : "Request access",
    href: `/dashboard/released-documents/request?documentId=${encodeURIComponent(document.documentId)}`,
    tone: "secondary" as const,
    disabled: false,
  };
}

function getRequestStepCopy(status: TriggerEligibleDocument["requestStatus"] | TriggerRequest["status"]) {
  if (status === "APPROVED") {
    return "Approved. The approved documents section opens after the controlled release is active.";
  }

  if (status === "UNDER_REVIEW") {
    return "Your proof is in queue and the officer will review it next.";
  }

  if (status === "ADDITIONAL_INFO_REQUIRED") {
    return "The officer requested more proof. Upload the new file in the proof flow.";
  }

  if (status === "REJECTED") {
    return "The request was rejected. You can start a fresh request for this eligible document.";
  }

  if (status === "CANCELLED") {
    return "This request was cancelled and no longer moves through the workflow.";
  }

  if (status === "PENDING") {
    return "The request was created and is waiting to move into review.";
  }

  return "Continue the proof flow to move this request forward.";
}

export default function EligibleDocumentRequestPage() {
  const authHelpText = "Sign in as the invited nominee to request document access.";
  const router = useRouter();
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [priority, setPriority] = useState<TriggerRequestPriority>("Medium");
  const [subjectLine, setSubjectLine] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: requestData, error: swrError } = useSWR(
    "/api/nominee/request/combined",
    async () => {
      const requestId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("requestId");
      const me = await getCurrentUser();
      const nextRole = inferAccountRole(me.user.role, me.permissions);
      
      if (nextRole !== "NOMINEE") {
        throw new Error("This request surface is reserved for nominees.");
      }

      const nomineePayload = await loadCurrentNominee().catch(() => null);
      const payload = await listEligibleDocumentRequests();
      
      let activeRequest: TriggerRequest | null = null;
      if (requestId) {
        const request = await getTriggerRequest(requestId);
        const keepActive = isActiveRequestStatus(request.request.status) || isApprovedRequestStatus(request.request.status);
        if (keepActive) {
          activeRequest = request.request;
        }
      }

      return {
        role: nextRole,
        documents: payload.documents,
        currentNominee: nomineePayload?.nominee ?? null,
        activeRequest,
      };
    },
    { refreshInterval: 5000 }
  );

  const role = requestData?.role ?? null;
  const documents = requestData?.documents ?? [];
  const currentNominee = requestData?.currentNominee ?? null;
  const activeRequest = requestData?.activeRequest ?? null;
  const loading = !requestData && !swrError;

  if (swrError && !error) {
    setError(isAuthenticationError(swrError) ? authHelpText : getErrorMessage(swrError, "Unable to load requests."));
  }

  const nomineeAssignedDocuments = currentNominee?.assignedDocuments ?? [];
  const documentCards = useMemo<TriggerEligibleDocument[]>(() => {
    if (documents.length) {
      return documents;
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
  }, [documents, nomineeAssignedDocuments]);

  useMemo(() => {
    if (!requestData || selectedDocumentId) return;
    const documentId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("documentId");
    
    const nomineeDocuments = requestData.currentNominee?.assignedDocuments ?? [];
    const combinedDocuments = requestData.documents.length
      ? requestData.documents
      : nomineeDocuments.map((document) => ({
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
    
    const firstDocument = combinedDocuments[0] ?? null;

    if (requestData.activeRequest) {
      const linkedDocument = requestData.activeRequest.documentId
        ? combinedDocuments.find((document) => document.documentId === requestData.activeRequest!.documentId) ?? firstDocument
        : firstDocument;

      if (linkedDocument) {
        setSelectedDocumentId(linkedDocument.documentId);
        setSubjectLine(`Request access to ${linkedDocument.documentTitle}`);
        setSummary(
          `I would like to submit proof so the document access workflow can continue for ${linkedDocument.documentTitle}.`
        );
      }
      return;
    }

    const requestDocumentId = documentId;
    const initialDocument =
      (requestDocumentId ? combinedDocuments.find((document) => document.documentId === requestDocumentId) ?? null : null) ?? firstDocument;

    if (initialDocument) {
      setSelectedDocumentId(initialDocument.documentId);
      setSubjectLine(`Request access to ${initialDocument.documentTitle}`);
      setSummary(
        `I am requesting access to ${initialDocument.documentTitle} according to the pre-defined customer rule.`
      );
    }
  }, [requestData, selectedDocumentId]);


  const selectedDocument = useMemo(
    () => documentCards.find((document) => document.documentId === selectedDocumentId) ?? null,
    [documentCards, selectedDocumentId]
  );

  const eligibleCount = useMemo(() => documentCards.length, [documentCards]);
  const requestableCount = useMemo(
    () => documentCards.filter((document) => !document.requestId || document.requestStatus === "DRAFT").length,
    [documentCards]
  );

  async function handleStartRequest() {
    if (!selectedDocument) {
      setError("Choose an eligible document first.");
      return;
    }

    if (!subjectLine.trim() || !summary.trim()) {
      setError("Subject line and summary are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const created = await createTriggerRequest({
        documentId: selectedDocument.documentId,
        requestKind: "document-access",
        subjectLine,
        summary,
        priority,
      });

      const requestId = created.request.id;
      const submitted = await submitTriggerRequest(requestId);
      setMessage(`Request ${submitted.request.status.toLowerCase()} for ${selectedDocument.documentTitle}.`);
      router.push(`/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(requestId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the document request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Nominee requests</Badge>
                <Badge variant="secondary">Access-rule documents</Badge>
              <Badge variant="secondary">Audit logged</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">Document request desk</p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Select one access-rule document and submit the proof package for controlled access.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                This surface shows the documents your customer has explicitly made eligible for this nominee. Unreleased vault data stays hidden, and the backend records every request, proof upload, and approval step.
              </p>
            </div>

            {activeRequest ? (
              <div className="rounded-[24px] border border-[#C7D2FE] bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getRequestBadgeVariant(activeRequest.status)}>{getRequestLabel(activeRequest.status)}</Badge>
                  <Badge variant={getReleaseBadgeVariant((selectedDocument?.releaseStatus ?? null) as TriggerEligibleDocument["releaseStatus"])}>{getReleaseLabel(selectedDocument?.releaseStatus ?? null)}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-[#0F172A]">Existing request loaded</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  We picked up request <span className="font-medium">{activeRequest.id}</span> so you can continue the proof flow without starting over.
                </p>
                <div className="mt-4 rounded-[22px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current stage</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{getRequestStepCopy(activeRequest.status)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {isApprovedRequestStatus(activeRequest.status) && selectedDocument?.releaseStatus === "RELEASED" ? (
                    <Button asChild>
                      <Link href="/dashboard/released-documents#released-documents">
                        <ArrowRight className="h-4 w-4" />
                        Open approved access
                      </Link>
                    </Button>
                  ) : isApprovedRequestStatus(activeRequest.status) ? (
                    <Button type="button" disabled>
                      <Lock className="h-4 w-4" />
                      Waiting for release
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href={`/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(activeRequest.id)}`}>
                        <UploadCloud className="h-4 w-4" />
                        Continue proof
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link href="/dashboard/released-documents">
                      <Lock className="h-4 w-4" />
                      Released documents
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session summary</CardTitle>
            <CardDescription>
              {role ? getAccountLabel(role) : "Loading session..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Linked to customer</Badge>
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
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {currentNominee?.email ?? "The invited nominee record is not yet linked to this account."}
                  </p>
                </div>
              </div>
              {currentNominee ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{currentNominee.relationship}</Badge>
                  <Badge variant={currentNominee.status === "ACTIVE" ? "success" : "warning"}>{currentNominee.status}</Badge>
                  <Badge variant="default">{currentNominee.assignedCount} assigned docs</Badge>
                </div>
              ) : null}
              <div className="mt-4">
                <Button asChild variant="outline">
                  <Link href="/dashboard/emergency/upload-proof">
                    Continue proof flow
                  </Link>
                </Button>
              </div>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Access-rule documents</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : eligibleCount}</p>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Ready to request</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : requestableCount}</p>
            </div>
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Workflow</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Choose a document, submit the request, upload proof, and let the nominee access section handle approval.
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
              The nominee request desk is bound to the signed-in invited nominee account. Please sign back in to continue.
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

      {message ? (
        <Card className="border-[#C7E3D1] bg-[#F2FBF5]">
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{message}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Eligible documents</CardTitle>
            <CardDescription>Documents explicitly assigned to this nominee by the owner are shown here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentCards.length ? (
              documentCards.map((document) => {
                const action = getDocumentAction(document);

                return (
                <div
                  key={document.documentId}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedDocumentId(document.documentId);
                    setSubjectLine(`Request access to ${document.documentTitle}`);
                    setSummary(
                      `I would like to submit proof so the document access workflow can continue for ${document.documentTitle}.`
                    );
                    setMessage(null);
                    setError(null);
                  }}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    selectedDocumentId === document.documentId
                      ? "border-[#163B8C] bg-[#EEF4FF]"
                      : "border-[#DCE3EC] bg-white hover:border-[#B9C7DD]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A]">{document.documentTitle}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{document.categoryName}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {document.fileName ?? "Encrypted file"} • {formatBytes(document.fileSize ?? 0)}
                      </p>
                    </div>
                    <Badge variant={getRequestBadgeVariant(document.requestStatus)}>{getRequestLabel(document.requestStatus)}</Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant={document.canView ? "success" : "secondary"}>{document.canView ? "View eligible" : "View blocked"}</Badge>
                    <Badge variant={document.canDownload ? "success" : "secondary"}>
                      {document.canDownload ? "Download eligible" : "Download blocked"}
                    </Badge>
                    <Badge variant={getReleaseBadgeVariant(document.releaseStatus)}>{getReleaseLabel(document.releaseStatus)}</Badge>
                    {document.proofCount > 0 && document.latestProofStatus && (
                      <Badge variant={document.latestProofStatus === "VERIFIED" ? "success" : document.latestProofStatus === "REJECTED" ? "destructive" : "warning"}>
                        Proof {document.latestProofStatus.toLowerCase()}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Action</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{action.label}</p>
                    </div>
                    {action.disabled ? (
                      <Button type="button" variant={action.tone} disabled>
                        <ArrowRight className="h-4 w-4" />
                        {action.label}
                      </Button>
                    ) : (
                      <Button asChild variant={action.tone}>
                        <Link href={action.href}>
                          <ArrowRight className="h-4 w-4" />
                          {action.label}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center">
                <Lock className="mx-auto h-10 w-10 text-[#163B8B]" />
                <p className="mt-4 text-base font-medium text-[#0F172A]">No access-rule documents yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  No access rules have been created for this nominee yet.
                </p>
                <div className="mx-auto mt-5 max-w-md rounded-[22px] border border-[#DCE3EC] bg-white p-4 text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">What to do next</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <li>Ask the owner to assign a document or category through Access Rules.</li>
                    <li>Refresh this page after the owner saves the rule.</li>
                    <li>Once the rule exists, the document will appear here for proof submission.</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document request</CardTitle>
              <CardDescription>
                Start a controlled request for the selected document and continue into proof submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
          {selectedDocument ? (
                <>
                  <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getRequestBadgeVariant(selectedDocument.requestStatus)}>
                        {getRequestLabel(selectedDocument.requestStatus)}
                      </Badge>
                      <Badge variant={getReleaseBadgeVariant(selectedDocument.releaseStatus)}>
                        {getReleaseLabel(selectedDocument.releaseStatus)}
                      </Badge>
                      {selectedDocument.proofCount > 0 && selectedDocument.latestProofStatus && (
                        <Badge variant={selectedDocument.latestProofStatus === "VERIFIED" ? "success" : selectedDocument.latestProofStatus === "REJECTED" ? "destructive" : "warning"}>
                          Proof {selectedDocument.latestProofStatus.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-3 text-xl font-semibold text-[#0F172A]">{selectedDocument.documentTitle}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedDocument.categoryName} • {selectedDocument.fileName ?? "Encrypted file"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedDocument.releaseCondition ?? "Controlled release proceeds after the request is reviewed."}
                    </p>
                    <div className="mt-4 rounded-[22px] border border-[#DCE3EC] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">What happens next</p>
                      <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                        {getRequestStepCopy(selectedDocument.requestStatus)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Last activity {formatDateTime(selectedDocument.latestActivityAt)}
                    </p>
                  </div>

              {isActiveRequestStatus(selectedDocument.requestStatus) || isApprovedRequestStatus(selectedDocument.requestStatus) ? (
                    <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                      <p className="text-sm font-medium text-[#0F172A]">Existing request</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        This document already has a live request record. Continue the proof flow rather than creating a duplicate.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge variant={getRequestBadgeVariant(selectedDocument.requestStatus)}>{getRequestLabel(selectedDocument.requestStatus)}</Badge>
                        <Badge variant={getReleaseBadgeVariant(selectedDocument.releaseStatus)}>{getReleaseLabel(selectedDocument.releaseStatus)}</Badge>
                        {selectedDocument.proofCount > 0 && selectedDocument.latestProofStatus && (
                          <Badge variant={selectedDocument.latestProofStatus === "VERIFIED" ? "success" : selectedDocument.latestProofStatus === "REJECTED" ? "destructive" : "warning"}>
                            Proof {selectedDocument.latestProofStatus.toLowerCase()}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {isApprovedRequestStatus(selectedDocument.requestStatus) ? (
                          <Button asChild>
                            <Link href="/dashboard/released-documents#released-documents">
                              <ArrowRight className="h-4 w-4" />
                              Open approved access
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild>
                            <Link href={`/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(selectedDocument.requestId!)}`}>
                              <UploadCloud className="h-4 w-4" />
                              Continue proof
                            </Link>
                          </Button>
                        )}
                        <Button asChild variant="outline">
                          <Link href="/dashboard/released-documents">
                            <ArrowLeft className="h-4 w-4" />
                            Released documents
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#0F172A]">Priority</label>
                        <select
                          value={priority}
                          onChange={(event) => setPriority(event.target.value as TriggerRequestPriority)}
                          className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                        >
                          {triggerRequestPriorities.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#0F172A]">Subject line</label>
                        <Input value={subjectLine} onChange={(event) => setSubjectLine(event.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#0F172A]">Summary</label>
                        <Textarea
                          value={summary}
                          onChange={(event) => setSummary(event.target.value)}
                          rows={5}
                          placeholder="Explain why this document should be released to you and what proof you are uploading."
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button type="button" onClick={() => void handleStartRequest()} disabled={submitting}>
                          <ArrowRight className="h-4 w-4" />
                          {submitting ? "Submitting..." : "Start proof submission"}
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/dashboard/released-documents">
                            <ArrowLeft className="h-4 w-4" />
                            Back to released documents
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-8 text-center">
                  <FileText className="mx-auto h-10 w-10 text-[#163B8B]" />
                  <p className="mt-4 text-base font-medium text-[#0F172A]">Select a document</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Pick one eligible document from the list on the left to review its request state or continue a proof submission.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flow guardrails</CardTitle>
              <CardDescription>What keeps this surface controlled.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Only documents explicitly assigned through access rules are listed.",
                "The backend records the request, the proof upload, and the review path.",
                "Released documents remain separate and continue to use the approved access section.",
                "Nominees never browse the full vault from this screen.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8B]" />
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
