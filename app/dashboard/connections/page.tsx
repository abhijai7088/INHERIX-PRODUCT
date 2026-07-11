"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ShieldCheck, Users, UserPlus } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Card, CardContent } from "@/components/inherix/card";
import { formatDateTime, formatRelationship } from "@/lib/records";
import { loadAccessRules, type AccessRuleRecord } from "@/lib/access-rules";
import { loadNominees, type NomineeApiRecord } from "@/lib/nominees";

type ConnectionRow = {
  id: string;
  name: string;
  relation: string;
  access: string;
  tone: "default" | "secondary" | "success" | "warning" | "destructive";
  updatedAt: string;
};

export default function ConnectionsPage() {
  const [nominees, setNominees] = useState<NomineeApiRecord[]>([]);
  const [rules, setRules] = useState<AccessRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [nomineePayload, rulesPayload] = await Promise.all([loadNominees(), loadAccessRules()]);
        if (!cancelled) {
          setNominees(nomineePayload.nominees);
          setRules(rulesPayload.rules);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load trusted connections.");
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
  }, []);

  const rows = useMemo<ConnectionRow[]>(() => {
    const ruleMap = new Map<string, AccessRuleRecord[]>();

    for (const rule of rules) {
      const current = ruleMap.get(rule.nomineeId) ?? [];
      current.push(rule);
      ruleMap.set(rule.nomineeId, current);
    }

    return nominees
      .filter((nominee) => nominee.status !== "REMOVED")
      .map((nominee) => {
        const nomineeRules = ruleMap.get(nominee.id) ?? [];
        const activeRuleCount = nomineeRules.filter((rule) => rule.status === "ACTIVE").length;
        const relation = formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined);

        return {
          id: nominee.id,
          name: nominee.fullName,
          relation,
          access: activeRuleCount
            ? `${activeRuleCount} active rule${activeRuleCount === 1 ? "" : "s"}`
            : nominee.status === "INVITED"
              ? "Invitation pending"
              : "No access rules yet",
          tone: (nominee.status === "ACTIVE" ? "success" : nominee.status === "INVITED" ? "warning" : "secondary") as ConnectionRow["tone"],
          updatedAt: nominee.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [nominees, rules]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.tone === "success").length,
      pending: rows.filter((row) => row.tone === "warning").length,
    }),
    [rows]
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Trusted Access</Badge>
            <Badge variant="secondary">Owner visible</Badge>
          </div>

          <h1 className="mt-4 text-[30px] font-semibold tracking-tight text-[#0F172A] md:text-[36px]">
            People You Trust
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500 md:text-base">
            Manage nominee relationships and access coverage using live backend records.
          </p>
        </div>

        <Link
          href="/dashboard/connections/invite"
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-5 text-sm font-medium text-white transition hover:bg-[#020617]"
        >
          <UserPlus className="h-4 w-4" />
          Invite New
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[28px] border border-[#DCE3EC] bg-white p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF]">
            <Users className="h-5 w-5 text-[#163B8C]" />
          </div>
          <h3 className="mt-4 text-3xl font-semibold text-[#0F172A]">{loading ? "..." : stats.total}</h3>
          <p className="mt-1 text-sm text-slate-500">Trusted Connections</p>
        </div>

        <div className="rounded-[28px] border border-[#DCE3EC] bg-white p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
          </div>
          <h3 className="mt-4 text-3xl font-semibold text-[#0F172A]">{loading ? "..." : stats.active}</h3>
          <p className="mt-1 text-sm text-slate-500">Active Connections</p>
        </div>

        <div className="rounded-[28px] border border-[#DCE3EC] bg-white p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
            <ShieldCheck className="h-5 w-5 text-amber-700" />
          </div>
          <h3 className="mt-4 text-3xl font-semibold text-[#0F172A]">{loading ? "..." : stats.pending}</h3>
          <p className="mt-1 text-sm text-slate-500">Pending Invitations</p>
        </div>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">Loading trusted connections...</CardContent>
          </Card>
        ) : rows.length ? (
          rows.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/connections/${item.id}`}
              className="group flex flex-col gap-5 rounded-[30px] border border-[#DCE3EC] bg-white p-5 transition hover:border-[#163B8C] hover:bg-[#F8FBFF] md:flex-row md:items-center md:justify-between md:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF4FF] text-lg font-semibold text-[#163B8C]">
                  {item.name
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[#0F172A]">{item.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.relation}</p>
                  <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700">
                    {item.access}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end md:gap-4">
                <p className="text-sm text-slate-400">{formatDateTime(item.updatedAt)}</p>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E2E8F0] transition group-hover:border-[#163B8C] group-hover:bg-[#163B8C]">
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white" />
                </div>
              </div>
            </Link>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              No trusted connections exist yet. Invite a nominee to start building access rules.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
