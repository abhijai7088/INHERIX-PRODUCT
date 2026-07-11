 "use client";

import { useRecordsStore } from "./RecordsProvider";

function percentage(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export default function VerificationStatus() {
  const { dashboardStats, records, nominees, triggerRequests } = useRecordsStore();
  const visibleRecords = records.filter((record) => !record.softDeleted);
  const verifiedRecords = visibleRecords.filter((record) => record.status === "Verified");

  const activeNominees = nominees.filter((nominee) => nominee.status === "ACTIVE");
  const pendingNominees = nominees.filter((nominee) => nominee.status === "INVITED" || nominee.status === "PENDING_VERIFICATION");
  const emergencyReadyRequests = triggerRequests.filter((request) => request.status === "APPROVED");

  const summary = [
    {
      label: "User Verification",
      status: activeNominees.length ? "Verified" : "Pending",
      tone: activeNominees.length ? "bg-emerald-500" : "bg-amber-500",
    },
    {
      label: "Beneficiary Verification",
      status: pendingNominees.length ? "Pending" : "Verified",
      tone: pendingNominees.length ? "bg-amber-500" : "bg-emerald-500",
    },
    {
      label: "Emergency Verification",
      status: emergencyReadyRequests.length ? "Normal" : "Pending",
      tone: emergencyReadyRequests.length ? "bg-[#163B8C]" : "bg-amber-500",
    },
    {
      label: "Vault Completeness",
      status: dashboardStats && dashboardStats.vaultsCount > 0 && dashboardStats.documentsCount > 0 ? "Configured" : "Needs Attention",
      tone: dashboardStats && dashboardStats.vaultsCount > 0 && dashboardStats.documentsCount > 0 ? "bg-[#163B8C]" : "bg-amber-500",
    },
  ];

  const completion = percentage(verifiedRecords.length, visibleRecords.length);
  const readiness = dashboardStats
    ? Math.min(100, Math.round((dashboardStats.documentsCount + dashboardStats.nomineesCount + dashboardStats.activeRulesCount) / 3))
    : completion;

  return (
    <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-7">
      <h2 className="text-[24px] font-semibold text-[#0F172A]">
        Verification Status
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Identity, beneficiary and emergency verification overview.
      </p>

      <div className="mt-4 space-y-4">
        {summary.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-2xl border border-[#EEF2F7] p-3"
          >
            <span className="font-medium text-[#0F172A]">
              {item.label}
            </span>

            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
              <span className="text-sm font-medium">
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-[#EEF4FF] p-4">
        <p className="text-xs text-slate-500">
          Family Continuity Score
        </p>

        <h3 className="mt-2 text-[28px] font-semibold text-[#163B8C]">
          {dashboardStats ? `${readiness}% Ready` : `${completion}% Complete`}
        </h3>

        <div className="mt-3 h-2 rounded-full bg-white">
          <div className="h-2 rounded-full bg-[#163B8C]" style={{ width: `${Math.max(completion, 12)}%` }} />
        </div>
      </div>
    </div>
  );
}
