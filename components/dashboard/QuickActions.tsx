"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  FolderPlus,
  HelpCircle,
  FileText,
  LogIn,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

import { inferAccountRole } from "@/lib/account";
import { getCurrentUser } from "@/lib/trigger-api";

export default function QuickActions() {
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

  const actions = useMemo(
    () =>
      role === "ADMIN" || role === "SUPER_ADMIN"
        ? [
            { label: "Open Trigger Queue", href: "/dashboard/admin", icon: Activity },
            { label: "Review Releases", href: "/dashboard/releases", icon: ShieldCheck },
            { label: "Open Reports", href: "/dashboard/reports", icon: FileText },
            { label: "Inspect Security", href: "/dashboard/security", icon: ShieldCheck },
            { label: "Manage Officers", href: "/dashboard/officers", icon: Users, adminOnly: true },
            { label: "System Settings", href: "/dashboard/settings", icon: FolderPlus, adminOnly: true },
            { label: "Audit Trail", href: "/dashboard/audit", icon: ArrowUpRight, adminOnly: true },
            { label: "Help & Support", href: "/dashboard/profile/support", icon: HelpCircle },
          ]
        : role === "VERIFICATION_OFFICER"
          ? [
              { label: "Open Review Desk", href: "/dashboard/emergency/verification", icon: Activity },
              { label: "Assigned Cases", href: "/dashboard/verification", icon: ShieldCheck },
              { label: "View Trigger Status", href: "/dashboard/emergency", icon: LogIn },
              { label: "Help & Support", href: "/dashboard/profile/support", icon: HelpCircle },
            ]
          : [
              { label: "Upload to Vault", href: "/dashboard/records/add", icon: Upload },
              { label: "Manage Contacts", href: "/dashboard/connections/access", icon: Users },
              { label: "View Plan", href: "/dashboard", icon: ShieldCheck },
              { label: "Continuity Activation", href: "/dashboard/activation", icon: LogIn },
              { label: "Backup Now", href: "/dashboard/backup", icon: FolderPlus },
              { label: "Help & Support", href: "/dashboard/profile/support", icon: HelpCircle },
            ],
    [role]
  );

  const visibleActions = useMemo(
    () => actions.filter((action) => !("adminOnly" in action && action.adminOnly) || role === "ADMIN" || role === "SUPER_ADMIN"),
    [role]
  );

  return (
    <div className="rounded-2xl border border-[#DCE3EC] bg-white p-5">
      <h2 className="text-[20px] font-semibold text-[#0F172A]">
        {role === "ADMIN" || role === "SUPER_ADMIN" ? "Operations Actions" : role === "VERIFICATION_OFFICER" ? "Review Actions" : "Quick Actions"}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-4">
        {visibleActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] p-5 text-left transition hover:border-[#163B8C] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#163B8C]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-[14px] font-medium text-[#0F172A]">
                    {action.label}
                  </p>
                </div>

                <ArrowUpRight className="h-4 w-4 text-slate-300" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
