"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChevronRight,
  Clock3,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/inherix/card";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { loadAccessRules, type AccessRuleRecord } from "@/lib/access-rules";
import { loadNominees, type NomineeApiRecord } from "@/lib/nominees";
import { formatRelationship } from "@/lib/records";

export default function ProfessionalsPage() {
  const authHelpText = "Sign in to view trusted access.";
  const [accessRules, setAccessRules] = useState<AccessRuleRecord[]>([]);
  const [nominees, setNominees] = useState<NomineeApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [rulesPayload, nomineePayload] = await Promise.all([
          loadAccessRules(),
          loadNominees(),
        ]);

        setAccessRules(rulesPayload.rules);
        setNominees(nomineePayload.nominees);
      } catch (loadError) {
        setError(isAuthenticationError(loadError) ? authHelpText : getErrorMessage(loadError, "Unable to load trusted access."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const stats = useMemo(() => ({
    total: accessRules.length,
    active: accessRules.filter((rule) => rule.status === "ACTIVE").length,
    pending: accessRules.filter((rule) => rule.status === "REVOKED" || rule.status === "DELETED" ? false : rule.status !== "ACTIVE").length,
  }), [accessRules]);

  const rows = useMemo(() => {
    const nomineeLookup = new Map(nominees.map((nominee) => [nominee.id, nominee] as const));

    return accessRules.map((rule) => {
      const nominee = nomineeLookup.get(rule.nomineeId);

      return {
        id: rule.id,
        name: nominee?.fullName ?? rule.nomineeFullName,
        role: nominee ? formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined) : rule.categoryName ?? "Access holder",
        email: nominee?.email ?? rule.nomineeEmail ?? "No email on file",
        access: rule.canView && rule.canDownload
          ? "Full Governance Access"
          : rule.canView
            ? "View Only Access"
            : "Restricted Access",
        status: rule.status === "ACTIVE" ? "Active" : "Pending Review",
        statusIcon: rule.status === "ACTIVE" ? ShieldCheck : Clock3,
      };
    });
  }, [accessRules, nominees]);

  return (
    <main className="min-h-screen bg-[#F5F7FB] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#163B8C] text-white">
              <Briefcase className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A]">
                Trusted Access
              </h1>
              <p className="mt-1 text-[14px] text-slate-500">
                Manage the people and access rules the owner has trusted to act on their behalf.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/connections/invite"
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#163B8C] px-5 text-sm font-medium text-white transition hover:bg-[#1D4ED8]"
        >
          <Plus className="h-4 w-4" />
          Invite Connection
        </Link>
      </div>

      {error === authHelpText ? (
        <Card className="mt-6 border-[#C7D2FE] bg-[#EEF4FF]">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-[#0F172A]">{authHelpText}</p>
            <p className="text-sm leading-6 text-slate-600">
              Your trusted access list is tied to the signed-in account. Sign back in to continue.
            </p>
            <Link href="/onboarding/login" className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#163B8C] px-5 text-sm font-medium text-white">
              Go to login
            </Link>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="mt-6 border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#DCE3EC] bg-white p-5">
          <p className="text-[13px] text-slate-500">Total Connections</p>
          <h2 className="mt-3 text-[30px] font-semibold text-[#0F172A]">{loading ? "…" : stats.total}</h2>
        </div>
        <div className="rounded-2xl border border-[#DCE3EC] bg-white p-5">
          <p className="text-[13px] text-slate-500">Active Access</p>
          <h2 className="mt-3 text-[30px] font-semibold text-emerald-600">{loading ? "…" : stats.active}</h2>
        </div>
        <div className="rounded-2xl border border-[#DCE3EC] bg-white p-5">
          <p className="text-[13px] text-slate-500">Pending Review</p>
          <h2 className="mt-3 text-[30px] font-semibold text-amber-600">{loading ? "…" : stats.pending}</h2>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Loading trusted access...
            </CardContent>
          </Card>
        ) : rows.length ? (
          rows.map((item) => {
            const StatusIcon = item.statusIcon;

            return (
              <div
                key={item.id}
                className="rounded-[28px] border border-[#DCE3EC] bg-white p-6"
              >
                <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF]">
                      <Users className="h-6 w-6 text-[#163B8C]" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-semibold text-[#0F172A]">{item.name}</h3>
                      <p className="mt-1 text-[14px] text-slate-500">{item.role}</p>
                      <p className="mt-2 text-[13px] text-slate-400">{item.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Access Level</p>
                      <h4 className="mt-2 text-[14px] font-medium text-[#0F172A]">{item.access}</h4>
                    </div>
                    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Verification</p>
                      <div className="mt-2 flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${item.status === "Active" ? "text-emerald-600" : "text-amber-500"}`} />
                        <span className={`text-[14px] font-medium ${item.status === "Active" ? "text-emerald-600" : "text-amber-600"}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link href="/dashboard/connections/access" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E2E8F0]">
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              No trusted access rules exist yet. Invite a connection or create access rules to populate this view.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
