"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MoreVertical, MessageSquare, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/inherix/card";
import { formatDateTime, formatRelationship } from "@/lib/records";
import { loadAccessRules, type AccessRuleRecord } from "@/lib/access-rules";
import { loadNominee, type NomineeApiRecord } from "@/lib/nominees";

export default function ConnectionDetailPage() {
  const params = useParams<{ id?: string }>();
  const nomineeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [nominee, setNominee] = useState<NomineeApiRecord | null>(null);
  const [rules, setRules] = useState<AccessRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nomineeId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [nomineePayload, rulesPayload] = await Promise.all([
          loadNominee(nomineeId),
          loadAccessRules({ nomineeId }),
        ]);

        if (!cancelled) {
          setNominee(nomineePayload.nominee);
          setRules(rulesPayload.rules);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load connection details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [nomineeId]);

  const accessSummary = useMemo(() => {
    const active = rules.filter((rule) => rule.status === "ACTIVE").length;
    const revoked = rules.filter((rule) => rule.status === "REVOKED").length;

    return { active, revoked };
  }, [rules]);

  if (!nomineeId) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6 md:p-8">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="icon">
            <Link href="/dashboard/connections">
              <ArrowLeft className="h-5 w-5 text-[#0F172A]" />
            </Link>
          </Button>

          <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#DCE3EC] bg-white transition hover:bg-[#F8FAFC]">
            <MoreVertical className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#EEF4FF] text-[28px] font-semibold text-[#163B8C]">
            {(nominee?.fullName ?? "??")
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <h1 className="mt-5 text-[30px] font-semibold tracking-tight text-[#0F172A]">
            {loading ? "Loading..." : nominee?.fullName ?? "Unknown nominee"}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {nominee ? formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined) : ""}
          </p>

          {nominee ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="secondary">{nominee.status}</Badge>
              <Badge variant="secondary">{nominee.invitationStatus}</Badge>
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-[28px] bg-[#F8FAFC] p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF]">
              <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
            </div>

            <div>
              <p className="text-sm text-slate-500">Access summary</p>
              <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
                {accessSummary.active} active rule{accessSummary.active === 1 ? "" : "s"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {accessSummary.revoked} revoked rule{accessSummary.revoked === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-4 text-sm text-slate-500">Loading permissions...</div>
            ) : rules.length ? (
              rules.map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-[#EEF2F7] bg-white p-4 text-sm text-slate-600">
                  {rule.scopeType === "DOCUMENT" ? rule.documentTitle ?? "Document scope" : rule.categoryName ?? "Category scope"}
                  {" - "}
                  {rule.releaseCondition}
                  {" - "}
                  {rule.canView ? "view" : "no view"}
                  {" - "}
                  {rule.canDownload ? "download" : "no download"}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-4 text-sm text-slate-500">
                No access rules have been assigned to this nominee yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Button className="mt-8 w-full" asChild>
          <Link href="/dashboard/family">
            <MessageSquare className="h-4 w-4" />
            Return to nominee management
          </Link>
        </Button>

        {nominee ? (
          <p className="mt-4 text-center text-xs text-slate-400">
            Updated {formatDateTime(nominee.updatedAt)}
          </p>
        ) : null}

        {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
