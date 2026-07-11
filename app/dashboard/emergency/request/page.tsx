"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileCheck, Lock, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { inferAccountRole, getAccountLabel, type AccountRole } from "@/lib/account";
import { formatRelationship, type RelationshipOption } from "@/lib/records";
import { backendJsonFetch } from "@/lib/auth-state";
import {
  createTriggerRequest,
  getCurrentUser,
  listTriggerRequests,
  submitTriggerRequest,
  type TriggerRequest,
  type TriggerRequestKind,
  type TriggerRequestPriority,
} from "@/lib/trigger-api";
import { triggerRequestKinds, triggerRequestPriorities } from "@/lib/trigger-workflow";

type Nominee = {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  relationship: string;
  customRelationship: string | null;
  status: string;
};

export default function TriggerRequestPage() {
  const router = useRouter();
  const authHelpText = "Sign in to start a trigger request.";
  const [role, setRole] = useState<AccountRole | null>(null);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [openRequests, setOpenRequests] = useState<TriggerRequest[]>([]);
  const [nomineeId, setNomineeId] = useState("");
  const [requestKind, setRequestKind] = useState<TriggerRequestKind>("medical");
  const [priority, setPriority] = useState<TriggerRequestPriority>("High");
  const [subjectLine, setSubjectLine] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getCurrentUser();
        const nextRole = inferAccountRole(me.user.role, me.permissions);
        setRole(nextRole);

        if (nextRole === "NOMINEE") {
          router.replace("/dashboard/released-documents/request");
          return;
        }

        if (nextRole === "CUSTOMER") {
          const nomineeResponse = await backendJsonFetch("/nominees");
          const nomineeJson = (await nomineeResponse.json().catch(() => null)) as { success?: boolean; data?: { nominees?: Nominee[] }; message?: string } | null;

          if (!nomineeResponse.ok) {
            throw new Error(nomineeJson?.message ?? "Unable to load nominees.");
          }

          const nextNominees = nomineeJson?.data?.nominees ?? [];
          setNominees(nextNominees.filter((nominee) => nominee.status !== "REMOVED"));
          setNomineeId((current) => current || nextNominees.find((nominee) => nominee.status !== "REMOVED")?.id || "");
        }

        const openRequestResponse = await listTriggerRequests();
        setOpenRequests(
          openRequestResponse.requests
            .filter(
              (request) =>
                request.status === "DRAFT" ||
                request.status === "PENDING" ||
                request.status === "UNDER_REVIEW" ||
                request.status === "ADDITIONAL_INFO_REQUIRED"
            )
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        );
      } catch (loadError) {
        setError(isAuthenticationError(loadError) ? authHelpText : getErrorMessage(loadError, "Unable to load the trigger request form."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const canCreate = role === "CUSTOMER";
  const accountLabel = getAccountLabel(role);
  const nomineeChoices = useMemo(() => nominees.filter((nominee) => nominee.status !== "REMOVED"), [nominees]);
  const selectedNominee = useMemo(() => nomineeChoices.find((nominee) => nominee.id === nomineeId) ?? null, [nomineeChoices, nomineeId]);
  const latestOpenRequest = useMemo(() => openRequests[0] ?? null, [openRequests]);
  const activeRequestForSelected = useMemo(
    () => openRequests.find((request) => request.nomineeId === nomineeId) ?? null,
    [nomineeId, openRequests]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canCreate) {
      setError("Trigger requests can only be created by an authenticated owner account.");
      return;
    }

    if (!nomineeId) {
      setError("Choose a nominee first.");
      return;
    }

    if (activeRequestForSelected) {
      setError("This nominee already has an open request.");
      return;
    }

    if (!subjectLine.trim() || !summary.trim()) {
      setError("Subject line and summary are required.");
      return;
    }

    setSubmitting(true);

    try {
      const created = await createTriggerRequest({
        nomineeId,
        requestKind,
        subjectLine,
        summary,
        priority,
      });

      const requestId = created.request.id;

      await submitTriggerRequest(requestId);

      router.push(`/dashboard/emergency/upload-proof?requestId=${requestId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the trigger request.");
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
              <Link href="/dashboard/emergency">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Badge variant="default">Trigger request</Badge>
            <Badge variant="secondary">Audit logged</Badge>
          </div>
          <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[40px]">
            Start a new controlled request
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
            Draft the request, submit it separately, and then upload proof through a signed temporary URL.
          </p>
        </div>

        <Card className="w-full max-w-[360px]">
          <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
                <div>
                <p className="text-sm font-medium text-[#0F172A]">{loading ? "Loading account..." : accountLabel}</p>
                <p className="text-xs text-slate-500">Only owner accounts can create a customer request.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F8FAFC] p-3 text-xs leading-6 text-slate-500">
              Requests are stored in PostgreSQL and protected by ownership checks, permissions, and an audit trail.
            </div>
            {canCreate && latestOpenRequest ? (
              <div className="rounded-[24px] border border-[#C7D2FE] bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Resume case</p>
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">{latestOpenRequest.subjectLine}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Continue request <span className="font-medium">{latestOpenRequest.id}</span> for {latestOpenRequest.nomineeName}.
                </p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href={`/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(latestOpenRequest.id)}`}>
                    Open proof upload
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Request details</CardTitle>
            <CardDescription>Describe the situation before proof is uploaded.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {role === "CUSTOMER" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Nominee</label>
                  <select
                    value={nomineeId}
                    onChange={(event) => setNomineeId(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                  >
                    <option value="">Select a nominee</option>
                    {nomineeChoices.map((nominee) => (
                      <option key={nominee.id} value={nominee.id}>
                        {nominee.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Nominee workflow</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Invited nominees use the released documents desk and proof upload flow instead of the owner trigger form.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/dashboard/released-documents/request">Open nominee request desk</Link>
                  </Button>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Request kind</label>
                  <select
                    value={requestKind}
                    onChange={(event) => setRequestKind(event.target.value as TriggerRequestKind)}
                    className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                  >
                    {triggerRequestKinds.filter((option) => option.value !== "document-access").map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Subject line</label>
                <Input
                  value={subjectLine}
                  onChange={(event) => setSubjectLine(event.target.value)}
                  placeholder="Hospital discharge review or legal order notice"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Summary</label>
                <Textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  rows={5}
                  placeholder="Explain what happened, why access is needed, and any context the reviewer should know."
                />
              </div>

              {selectedNominee ? (
                <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Selected nominee</p>
                  <p className="mt-2 font-semibold text-[#0F172A]">{selectedNominee.fullName}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatRelationship(
                      selectedNominee.relationship as RelationshipOption,
                      selectedNominee.customRelationship ?? undefined
                    )}
                  </p>
                </div>
              ) : null}

              {error === authHelpText ? (
                <div className="rounded-2xl border border-[#C7D2FE] bg-[#EEF4FF] p-4 text-sm text-[#0F172A]">
                  <p className="font-medium">{authHelpText}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Sign back in to draft and submit trigger requests from the protected workspace.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/onboarding/login">Go to login</Link>
                  </Button>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!canCreate || submitting}>
                  {submitting ? "Submitting..." : "Submit request"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/emergency">Cancel</Link>
                </Button>
              </div>

              {activeRequestForSelected ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">Open request already exists for this nominee</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900/80">
                    Request <span className="font-medium">{activeRequestForSelected.id}</span> is already in the workflow. Open the proof screen instead of starting a duplicate.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href={`/dashboard/emergency/upload-proof?requestId=${encodeURIComponent(activeRequestForSelected.id)}`}>
                      Continue proof
                    </Link>
                  </Button>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow steps</CardTitle>
              <CardDescription>The request becomes a proof upload task immediately after submission.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Draft the request and choose the nominee if required.",
                "Submit so the request enters the controlled queue.",
                "Upload proof using a signed temporary URL.",
                "Review progress from the verification queue.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                  <FileCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#EEF4FF]">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-[#163B8C]" />
                <p className="text-sm font-medium text-[#0F172A]">Ownership enforced</p>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                The backend checks nominee assignment and authenticated identity before saving the request.
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <UserRound className="h-4 w-4 text-[#163B8C]" />
                {accountLabel}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
