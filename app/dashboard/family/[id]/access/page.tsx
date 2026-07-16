"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FolderLock,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { backendJsonFetch } from "@/lib/auth-state";
import { loadNominee, type NomineeApiRecord } from "@/lib/nominees";
import {
  createAccessRule,
  deleteAccessRule,
  loadAccessRules,
  reactivateAccessRule,
  revokeAccessRule,
  type AccessRuleRecord,
} from "@/lib/access-rules";

type SelectOption = {
  id: string;
  label: string;
};

const releaseConditions = [
  { value: "DEATH_EVENT", label: "Death event" },
  { value: "MEDICAL_INCAPACITY", label: "Medical incapacity" },
  { value: "LEGAL_EVENT", label: "Legal event" },
  { value: "EMERGENCY_ACCESS", label: "Emergency access" },
  { value: "OWNER_INACTIVE", label: "Owner inactive" },
  { value: "OTHER", label: "Other" },
] as const;

const CONDITION_NOTES_SUGGESTIONS: Record<string, string[]> = {
  DEATH_EVENT: ["Death certificate required", "Requires verification from family lawyer"],
  MEDICAL_INCAPACITY: ["Provide letter from treating physician", "Hospital admission records required"],
  LEGAL_EVENT: ["Court order required", "Power of attorney activation required"],
  EMERGENCY_ACCESS: ["Severe accident or disaster", "Life-threatening emergency only"],
  OWNER_INACTIVE: ["No login activity for 90 days", "Unreachable by phone for 30 days"],
  OTHER: ["Requires my direct written consent", "For educational use only"],
};


function getScopeLabel(rule: AccessRuleRecord) {
  if (rule.scopeType === "DOCUMENT") {
    return rule.documentTitle ?? "Document scope";
  }

  return rule.categoryName ?? "Category scope";
}

function getStatusTone(status: AccessRuleRecord["status"]) {
  if (status === "ACTIVE") return "success";
  if (status === "REVOKED") return "warning";
  return "destructive";
}

async function readBackendPayload<T>(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? "The request could not be completed.");
  }

  return (payload?.data ?? payload) as T;
}

export default function NomineeAccessRulesPage() {
  const params = useParams<{ id: string }>();
  const nomineeId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";

  const [nominee, setNominee] = useState<NomineeApiRecord | null>(null);
  const [rules, setRules] = useState<AccessRuleRecord[]>([]);
  const [documents, setDocuments] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scopeType, setScopeType] = useState<"DOCUMENT" | "CATEGORY">("DOCUMENT");
  const [scopeId, setScopeId] = useState("");
  const [releaseCondition, setReleaseCondition] = useState<(typeof releaseConditions)[number]["value"]>("DEATH_EVENT");
  const [canView, setCanView] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [conditionNotes, setConditionNotes] = useState("");
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);

  async function refreshData() {
    setLoading(true);
    setError(null);

    try {
      const [nomineePayload, rulesPayload, documentsPayload, categoriesResponse] = await Promise.all([
        loadNominee(nomineeId),
        loadAccessRules({ nomineeId }),
        backendJsonFetch("/documents"),
        backendJsonFetch("/document-categories"),
      ]);

      const documentsData = await readBackendPayload<{ documents: Array<{ id: string; documentTitle: string }> }>(documentsPayload);
      const categoriesData = await readBackendPayload<{ categories: Array<{ id: string; categoryName: string }> }>(categoriesResponse);

      setNominee(nomineePayload.nominee);
      setRules(rulesPayload.rules);
      setDocuments(
        documentsData.documents.map((document) => ({
          id: document.id,
          label: document.documentTitle,
        }))
      );
      setCategories(
        categoriesData.categories.map((category) => ({
          id: category.id,
          label: category.categoryName,
        }))
      );
      setScopeId((current) => current || documentsData.documents[0]?.id || categoriesData.categories[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load access rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refreshData();
    }, 0);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomineeId]);

  const visibleOptions = scopeType === "DOCUMENT" ? documents : categories;

  const counts = useMemo(
    () => ({
      active: rules.filter((rule) => rule.status === "ACTIVE").length,
      revoked: rules.filter((rule) => rule.status === "REVOKED").length,
      deleted: rules.filter((rule) => rule.status === "DELETED").length,
    }),
    [rules]
  );

  async function handleCreateRule() {
    if (!scopeId) {
      setError("Select a document or category scope.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      await createAccessRule({
        nomineeId,
        documentId: scopeType === "DOCUMENT" ? scopeId : null,
        categoryId: scopeType === "CATEGORY" ? scopeId : null,
        canView,
        canDownload,
        releaseCondition,
        conditionNotes: conditionNotes.trim() || null,
      });

      setFeedback("Access rule saved and audited.");
      setConditionNotes("");
      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save access rule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRuleAction(ruleId: string, action: "revoke" | "reactivate" | "delete") {
    setPendingRuleId(ruleId);
    setError(null);
    setFeedback(null);

    try {
      if (action === "revoke") {
        await revokeAccessRule(ruleId);
        setFeedback("Access rule revoked.");
      } else if (action === "reactivate") {
        await reactivateAccessRule(ruleId);
        setFeedback("Access rule reactivated.");
      } else {
        await deleteAccessRule(ruleId);
        setFeedback("Access rule deleted.");
      }

      await refreshData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update access rule.");
    } finally {
      setPendingRuleId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8">
          <p className="text-sm font-medium text-[#163B8C]">Access Rules</p>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Loading nominee access</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500">
            Retrieving the access rules, nominee profile and scoped documents securely.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!nominee) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8">
          <p className="text-sm font-medium text-[#163B8C]">Access Rules</p>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Nominee not found</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500">
            The nominee is unavailable or outside the current owner scope.
          </p>
          <Button asChild>
            <Link href="/dashboard/family">
              <ArrowLeft className="h-4 w-4" />
              Back to nominees
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="icon">
                <Link href={`/dashboard/family/${nominee.id}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Badge variant="default">Access rules</Badge>
              <Badge variant="secondary">{nominee.status}</Badge>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#EEF4FF] text-xl font-semibold text-[#163B8C]">
                  {nominee.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                    Scoped nominee
                  </p>
                  <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[42px]">
                    {nominee.fullName}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {nominee.email ?? "No nominee email on file"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                  <p className="text-sm text-slate-500">Active rules</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{counts.active}</p>
                </div>
                <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                  <p className="text-sm text-slate-500">Revoked</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{counts.revoked}</p>
                </div>
                <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                  <p className="text-sm text-slate-500">Deleted</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{counts.deleted}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protection note</CardTitle>
            <CardDescription>
              Rule setup never exposes unreleased vault data to the nominee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <p className="text-sm leading-6 text-slate-600">
                Access rules define future release conditions only. They do not reveal documents until trigger verification and controlled release are completed.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <p className="text-sm leading-6 text-slate-600">
                Every create, update, revoke, reactivate and delete action is logged for audit review.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {feedback ? (
        <Card className="border-[#C7E3D1] bg-[#F2FBF5]">
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{feedback}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>New access rule</CardTitle>
            <CardDescription>
              Assign one document or category scope to the nominee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#0F172A]">Scope type</span>
                <select
                  value={scopeType}
                  onChange={(event) => {
                    const nextScopeType = event.target.value as "DOCUMENT" | "CATEGORY";
                    setScopeType(nextScopeType);
                    setScopeId(
                      nextScopeType === "DOCUMENT"
                        ? documents[0]?.id ?? ""
                        : categories[0]?.id ?? ""
                    );
                  }}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                >
                  <option value="DOCUMENT">Document</option>
                  <option value="CATEGORY">Category</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#0F172A]">
                  {scopeType === "DOCUMENT" ? "Document" : "Category"}
                </span>
                <select
                  value={scopeId}
                  onChange={(event) => setScopeId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                >
                  {visibleOptions.length ? (
                    visibleOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="">No options available</option>
                  )}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#0F172A]">Release condition</span>
                <select
                  value={releaseCondition}
                  onChange={(event) => setReleaseCondition(event.target.value as (typeof releaseConditions)[number]["value"])}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                >
                  {releaseConditions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#0F172A]">Condition notes</span>
                <Input
                  value={conditionNotes}
                  onChange={(event) => setConditionNotes(event.target.value)}
                  placeholder="Optional internal notes"
                />
                {CONDITION_NOTES_SUGGESTIONS[releaseCondition] && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CONDITION_NOTES_SUGGESTIONS[releaseCondition].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setConditionNotes(suggestion)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                          conditionNotes === suggestion
                            ? "border-[#163B8C] bg-[#EEF4FF] text-[#163B8C]"
                            : "border-slate-200 bg-white text-slate-600 hover:border-[#163B8C] hover:text-[#163B8C]"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </label>

            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm">
                Preview allowed
                <input
                  type="checkbox"
                  checked={canView}
                  onChange={(event) => setCanView(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
              <label className="flex items-center justify-between rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm">
                Download allowed
                <input
                  type="checkbox"
                  checked={canDownload}
                  onChange={(event) => setCanDownload(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
            </div>

            <Button onClick={() => void handleCreateRule()} disabled={saving || !visibleOptions.length}>
              <FolderLock className="h-4 w-4" />
              {saving ? "Saving..." : "Save access rule"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing access rules</CardTitle>
            <CardDescription>
              View and adjust existing owner-defined rule state.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rules.length ? (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="space-y-4 rounded-[24px] border border-[#DCE3EC] bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusTone(rule.status)}>{rule.status}</Badge>
                    <Badge variant="secondary">{rule.scopeType}</Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[#0F172A]">{getScopeLabel(rule)}</p>
                    <p className="text-sm text-slate-500">{rule.nomineeFullName}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#F8FAFC] p-3">
                      <p className="text-xs text-slate-500">Condition</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{rule.releaseCondition}</p>
                    </div>
                    <div className="rounded-2xl bg-[#F8FAFC] p-3">
                      <p className="text-xs text-slate-500">Access</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">
                        {rule.canView ? "Preview" : "No preview"} · {rule.canDownload ? "Download" : "No download"}
                      </p>
                    </div>
                  </div>

                  {rule.conditionNotes ? (
                    <div className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                      <p className="text-xs text-slate-500">Notes</p>
                      <p className="mt-1 text-sm leading-6 text-[#0F172A]">{rule.conditionNotes}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {rule.status === "ACTIVE" ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleRuleAction(rule.id, "revoke")}
                        disabled={pendingRuleId === rule.id}
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Revoke
                      </Button>
                    ) : null}
                    {rule.status !== "ACTIVE" ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleRuleAction(rule.id, "reactivate")}
                        disabled={pendingRuleId === rule.id}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Reactivate
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      onClick={() => void handleRuleAction(rule.id, "delete")}
                      disabled={pendingRuleId === rule.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                No access rules have been created for this nominee yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="bg-[#EEF4FF]">
        <CardContent className="flex items-start gap-4 p-6">
          <Download className="mt-0.5 h-6 w-6 text-[#163B8C]" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Release stays separate</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Access rules do not grant access by themselves. A trigger must still be verified and a document must be released before a nominee can view or download anything.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
