"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  FolderOpen,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";

import { useRecordsStore } from "./RecordsProvider";
import { getCurrentUser } from "@/lib/trigger-api";
import { inferAccountRole } from "@/lib/account";

export default function TopHeader() {
  const { dashboardStats, records, nominees, triggerRequests } = useRecordsStore();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        if (active) {
          setRole(inferAccountRole(me.user.role, me.permissions));
        }
      } catch {
        if (active) {
          setRole(null);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const protectedRecords = dashboardStats?.documentsCount ?? records.filter((record) => !record.softDeleted).length;
  const activeNominees = dashboardStats?.nomineesCount ?? nominees.filter((nominee) => nominee.status === "ACTIVE").length;
  const openRequests = triggerRequests.filter((request) => request.status === "PENDING" || request.status === "UNDER_REVIEW" || request.status === "ADDITIONAL_INFO_REQUIRED").length;
  const planReady = Boolean(dashboardStats && dashboardStats.vaultsCount > 0 && dashboardStats.documentsCount > 0);
  const planStatus = planReady ? "Configured" : "Setup required";
  const planTone = planReady ? "text-emerald-600" : "text-amber-600";
  const isPrivileged = role === "ADMIN" || role === "SUPER_ADMIN" || role === "VERIFICATION_OFFICER";
  const isNominee = role === "NOMINEE";
  const headline = role ? (isPrivileged ? "Operations Console" : isNominee ? "Nominee Workflow" : "Owner Workspace") : "Continuity Workspace";
  const subtitle = isPrivileged
    ? "Live queue pressure, release posture and security activity at a glance."
    : isNominee
      ? "Your owner-assigned documents, proof requests and review status live here."
      : role
        ? "Your family continuity plan is ready for your direct control."
        : "Loading your role-specific workspace...";
  const supportingCopy = isPrivileged
    ? "Review live cases, releases and security signals without leaving the console."
    : isNominee
      ? "Open the request desk, continue proof upload, and keep only invited nominee items in view."
      : role
        ? "Continue securing your records, nominees and approvals."
        : "Fetching the right permissions and dashboard sections now.";
  const firstMetricLabel = isPrivileged ? "Live records" : isNominee ? "Assigned docs" : role ? "Owner records" : "Records";
  const secondMetricLabel = isPrivileged ? "Open cases" : isNominee ? "Proof requests" : role ? "Owner nominees" : "Nominees";
  const thirdMetricLabel = isPrivileged ? "Queue items" : isNominee ? "Pending proofs" : role ? "Owner trigger requests" : "Workflow items";

  return (
    <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6 lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-4 py-2">
            <ShieldCheck className="h-4 w-4 text-[#163B8C]" />
            <span className="text-xs font-medium text-[#163B8C]">
              {isPrivileged
                ? "Operator Access Protected"
                : isNominee
                  ? "Nominee Access Protected"
                : "Owner Access Protected"}
            </span>
          </div>

          <h1 className="text-[34px] font-semibold tracking-tight text-[#0F172A]">
            {headline}
          </h1>

          <p className="mt-3 text-[15px] text-slate-500">
            {subtitle}
            <span className={`font-semibold ${planTone}`}>
              {" "}{planStatus}.
            </span>
            {supportingCopy}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-[#E8EDF5] bg-[#F8FAFC] px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">
                <FolderOpen className="h-4 w-4 text-[#E8B24A]" />
              </div>

              <div>
                <p className="text-[12px] font-medium text-[#7B8794]">
                  Plan Status
                </p>

                <h3 className={`mt-0.5 text-[15px] font-semibold ${planTone}`}>
                  {planStatus}
                </h3>
              </div>
            </div>
          </div>

          <Link href="/dashboard/profile/notifications" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE3EC] bg-white">
            <Bell className="h-5 w-5" />
          </Link>

          <Link href="/dashboard/profile/support" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE3EC] bg-white">
            <HelpCircle className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#F8FAFC] p-4">
          <p className="text-xs text-slate-500">{firstMetricLabel}</p>
          <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{protectedRecords}</p>
        </div>

        <div className="rounded-2xl bg-[#F8FAFC] p-4">
          <p className="text-xs text-slate-500">{secondMetricLabel}</p>
          <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{activeNominees}</p>
        </div>

        <div className="rounded-2xl bg-[#F8FAFC] p-4">
          <p className="text-xs text-slate-500">{thirdMetricLabel}</p>
          <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{openRequests}</p>
        </div>
      </div>
    </div>
  );
}
