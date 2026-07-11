"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Clock3,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { useRecordsStore } from "./RecordsProvider";
import { getCurrentUser } from "@/lib/trigger-api";

export default function EmergencyStatus() {
  const { triggerRequests } = useRecordsStore();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        if (active) {
          setRole(me.user.role);
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

  const pendingReviews = triggerRequests.filter((request) =>
    request.status === "PENDING" || request.status === "UNDER_REVIEW" || request.status === "ADDITIONAL_INFO_REQUIRED"
  ).length;
  const readiness = Math.max(0, 100 - pendingReviews * 10);
  const statusLabel = pendingReviews > 0 ? "Review required" : "Normal";
  const statusTone = pendingReviews > 0 ? "text-amber-600" : "text-emerald-600";
  const reviewHref = role === "VERIFICATION_OFFICER" || role === "ADMIN" || role === "SUPER_ADMIN" ? "/dashboard/emergency/verification" : "/dashboard/emergency";

  return (
    <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0F172A]">
            Emergency Status
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Controlled emergency access monitoring
          </p>
        </div>

        <ShieldAlert className="h-6 w-6 text-[#163B8C]" />
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-2xl border p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span>Current Status</span>
          </div>

          <span className={`font-medium ${statusTone}`}>
            {statusLabel}
          </span>
        </div>

        <Link href={reviewHref} className="flex items-center justify-between rounded-2xl border p-4 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-amber-500" />
            <span>Pending Reviews</span>
          </div>

          <span className="font-medium">
            {pendingReviews}
          </span>
        </Link>
      </div>

      <div className="mt-5 rounded-2xl bg-[#EEF4FF] p-4">
        <p className="text-xs text-slate-500">
          Emergency Readiness
        </p>

        <h3 className="mt-2 text-2xl font-semibold text-[#163B8C]">
          {readiness}%
        </h3>
      </div>
    </div>
  );
}
