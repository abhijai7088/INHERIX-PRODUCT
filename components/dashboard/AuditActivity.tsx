 "use client";

import { History, ShieldCheck } from "lucide-react";

import { formatDateOnly } from "@/lib/records";

import { useRecordsStore } from "./RecordsProvider";

export default function AuditActivity() {
  const { auditLogs } = useRecordsStore();
  const recentAudits = auditLogs.slice(0, 3);

  return (
    <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Audit Activity
          </h2>
          <p className="text-sm text-slate-500">
            Security and compliance events
          </p>
        </div>

        <History className="h-5 w-5 text-[#163B8C]" />
      </div>

      <div className="mt-6 space-y-4">
        {recentAudits.length ? recentAudits.map((audit) => (
          <div
            key={audit.id}
            className="flex items-center justify-between rounded-2xl border p-4"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
              <div>
                <span>{audit.entityType ?? "Audit event"}</span>
                <p className="text-xs text-slate-500">{audit.action.replaceAll("-", " ")}</p>
              </div>
            </div>

            <span className="text-sm text-slate-500">
              {formatDateOnly(audit.createdAt)}
            </span>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
            No audit entries yet.
          </div>
        )}
      </div>
    </div>
  );
}
