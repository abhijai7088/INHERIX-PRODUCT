"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/trigger-api";

export default function BackupExport() {
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

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-7">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight text-[#0F172A]">
            Backup & Export
          </h2>

          <p className="mt-3 max-w-[600px] text-sm leading-7 text-slate-500">
            Maintain encrypted backups and export continuity records securely for legal, governance, and family coordination purposes.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/dashboard/backup"
            className="inline-flex h-12 items-center rounded-2xl border border-[#DCE3EC] bg-white px-6 text-sm font-medium text-[#0F172A] transition hover:bg-[#F8FAFC]"
          >
            Backup Now
          </Link>

          <Link
            href="/dashboard/backup"
            className="inline-flex h-12 items-center rounded-2xl bg-[#163B8C] px-6 text-sm font-medium text-white transition hover:bg-[#1D4ED8]"
          >
            Export Data
          </Link>
        </div>
      </div>
    </div>
  );
}
