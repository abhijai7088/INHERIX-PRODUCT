"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatDateTime } from "@/lib/records";
import { getCurrentUser } from "@/lib/trigger-api";

import { useRecordsStore } from "./RecordsProvider";

export default function ActivityLogs() {
  const { auditLogs, notifications } = useRecordsStore();
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

  const logs = useMemo(
    () =>
      [
        ...notifications.slice(0, 3).map((item) => ({
          title: item.title,
          desc: item.message,
          time: formatDateTime(item.createdAt),
          href: item.metadata && typeof item.metadata.href === "string" ? item.metadata.href : "/dashboard/profile/notifications",
        })),
        ...(role === "ADMIN" || role === "SUPER_ADMIN"
          ? auditLogs.slice(0, 1).map((item) => ({
              title: item.action.replaceAll("-", " "),
              desc: item.entityType ? `${item.entityType} event recorded` : "Audit event recorded",
              time: formatDateTime(item.createdAt),
              href: "/dashboard/logs",
            }))
          : []),
      ].slice(0, 4),
    [auditLogs, notifications, role]
  );
  const viewAllHref = role === "ADMIN" || role === "SUPER_ADMIN" ? "/dashboard/logs" : "/dashboard/profile/notifications";

  return (
    <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-7">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#0F172A]">
            Recent Activity
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            System activity and governance actions
          </p>
        </div>

        <Link href={viewAllHref} className="text-sm font-medium text-[#163B8C]">
          View All
        </Link>
      </div>

      <div className="mt-8 space-y-5">
        {logs.length ? logs.map((log) => (
          <Link
            key={`${log.title}-${log.time}`}
            href={log.href}
            className="flex items-start justify-between rounded-2xl border border-[#EEF2F7] p-5 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
          >
            <div className="flex gap-4">
              <div className="mt-1 h-3 w-3 rounded-full bg-[#163B8C]" />
              <div>
                <h3 className="text-[15px] font-semibold text-[#0F172A]">
                  {log.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {log.desc}
                </p>
              </div>
            </div>

            <span className="text-sm text-slate-400">
              {log.time}
            </span>
          </Link>
        )) : (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
            No recent activity yet.
          </div>
        )}
      </div>
    </div>
  );
}
