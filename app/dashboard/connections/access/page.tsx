"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FolderLock, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { backendJsonFetch } from "@/lib/auth-state";
import { loadAccessRules, type AccessRuleRecord } from "@/lib/access-rules";

function getTone(status: AccessRuleRecord["status"]) {
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

export default function AccessConnectionsPage() {
  const [rules, setRules] = useState<AccessRuleRecord[]>([]);
  const [documents, setDocuments] = useState<{ id: string; documentTitle: string }[]>([]);
  const [nominees, setNominees] = useState<{ id: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshData() {
    setLoading(true);
    setError(null);

    try {
      const [rulesPayload, documentsResponse, nomineesResponse] = await Promise.all([
        loadAccessRules(),
        backendJsonFetch("/documents"),
        backendJsonFetch("/nominees"),
      ]);

      const documentsPayload = await readBackendPayload<{ documents: { id: string; documentTitle: string }[] }>(documentsResponse);
      const nomineesPayload = await readBackendPayload<{ nominees: { id: string; fullName: string }[] }>(nomineesResponse);

      setRules(rulesPayload.rules);
      setDocuments(documentsPayload.documents);
      setNominees(nomineesPayload.nominees);
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
  }, []);

  const stats = useMemo(
    () => ({
      active: rules.filter((rule) => rule.status === "ACTIVE").length,
      revoked: rules.filter((rule) => rule.status === "REVOKED").length,
      deleted: rules.filter((rule) => rule.status === "DELETED").length,
    }),
    [rules]
  );

  const nomineeLookup = useMemo(
    () => new Map(nominees.map((nominee) => [nominee.id, nominee.fullName] as const)),
    [nominees]
  );

  const documentLookup = useMemo(
    () => new Map(documents.map((document) => [document.id, document.documentTitle] as const)),
    [documents]
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Access Rules Center</Badge>
            <Badge variant="secondary">Customer scoped</Badge>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
              Connection Access
            </p>
            <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[42px]">
              Review and govern nominee access rules without exposing vault data.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-500 lg:text-base">
              This center shows the rules the owner has configured for nominees. It does not release documents; it just tracks the release conditions and rule state.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Active rules</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.active}</p>
            </div>
            <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Revoked rules</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.revoked}</p>
            </div>
            <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Deleted rules</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.deleted}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <FolderLock className="mt-0.5 h-5 w-5 text-[#163B8C]" />
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Scope-based control</p>
              <p className="mt-1 text-sm text-slate-500">
                Each rule is tied to one document or category only.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Audited actions</p>
              <p className="mt-1 text-sm text-slate-500">
                Create, update, revoke and delete operations are all logged.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <Users className="mt-0.5 h-5 w-5 text-[#163B8C]" />
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Nominee focused</p>
              <p className="mt-1 text-sm text-slate-500">
                No rule opens unreleased vault content on its own.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Access rule register</CardTitle>
          <CardDescription>
            Review the current owner-defined access rule set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
              Loading access rules...
            </div>
          ) : rules.length ? (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-4 rounded-[28px] border border-[#DCE3EC] bg-white p-5 transition hover:border-[#163B8C] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-[#0F172A]">
                      {rule.scopeType === "DOCUMENT"
                        ? documentLookup.get(rule.documentId ?? "") ?? rule.documentTitle ?? "Document scope"
                        : rule.categoryName ?? "Category scope"}
                    </h3>
                    <Badge variant={getTone(rule.status)}>{rule.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {nomineeLookup.get(rule.nomineeId) ?? rule.nomineeFullName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {rule.releaseCondition} · {rule.canView ? "preview" : "no preview"} · {rule.canDownload ? "download" : "no download"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/dashboard/family/${rule.nomineeId}/access`}
                    className="rounded-2xl border border-[#DCE3EC] bg-white px-4 py-2 text-sm font-medium text-[#0F172A]"
                  >
                    Open rule
                  </Link>
                  <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-[#163B8C]" />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
              No access rules have been configured yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
