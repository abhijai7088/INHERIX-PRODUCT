"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  FolderOpen,
  ShieldCheck,
  Users,
} from "lucide-react";

import { getCurrentUser } from "@/lib/trigger-api";
import { inferAccountRole } from "@/lib/account";
import { formatDateOnly } from "@/lib/records";

import { useRecordsStore } from "./RecordsProvider";

export default function OverviewCards() {
  const { records, nominees, triggerRequests, documentReleases, audits } = useRecordsStore();
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

  const isPrivileged = role === "ADMIN" || role === "SUPER_ADMIN" || role === "VERIFICATION_OFFICER";

  const visibleRecords = records.filter((record) => !record.softDeleted);
  const verifiedRecords = visibleRecords.filter((record) => record.status === "Verified");
  const activeProfessionals = nominees.filter((nominee) => nominee.status === "ACTIVE" || nominee.status === "PENDING_VERIFICATION");
  const pendingEmergencyCases = triggerRequests.filter((request) =>
    request.status === "PENDING" || request.status === "UNDER_REVIEW" || request.status === "ADDITIONAL_INFO_REQUIRED"
  ).length;
  const releasedDocuments = documentReleases.filter((release) =>
    release.releaseStatus === "RELEASED" || release.releaseStatus === "COMPLETED"
  ).length;
  const latestAuditDate = audits[0]?.createdAt ?? new Date().toISOString();

  const cards = [
    {
      title: isPrivileged ? "Live Records" : "Continuity Records",
      value: String(visibleRecords.length),
      desc: isPrivileged ? "Records currently visible in the live vault" : "Securely stored records",
      icon: FolderOpen,
      color: "bg-blue-50 text-blue-700",
      href: "/dashboard/records",
    },
    {
      title: isPrivileged ? "Review-Ready Cases" : "Verified Documents",
      value: String(verifiedRecords.length),
      desc: isPrivileged ? "Documents ready for review or release" : "Successfully verified",
      icon: ShieldCheck,
      color: "bg-emerald-50 text-emerald-700",
      href: "/dashboard/verification",
    },
    {
      title: isPrivileged ? "Assigned Access" : "Professional Access",
      value: String(activeProfessionals.length),
      desc: isPrivileged ? "Trusted contacts and assigned operators" : "Trusted professionals",
      icon: Users,
      color: "bg-violet-50 text-violet-700",
      href: "/dashboard/professionals",
    },
    {
      title: isPrivileged ? "Trigger Queue" : "Emergency Status",
      value: pendingEmergencyCases > 0 ? "Review" : "Normal",
      desc: isPrivileged ? `${releasedDocuments} released documents ready for nominee access` : `${releasedDocuments} released documents`,
      icon: Activity,
      color: pendingEmergencyCases > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
      href: "/dashboard/emergency",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Link
            key={card.title}
            href={card.href}
            className="group relative overflow-hidden rounded-[30px] border border-[#DCE3EC] bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#163B8C] hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-[#0F172A]">{card.title}</p>
              </div>

              <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#163B8C]" />
            </div>

            <div className="mt-3">
              <h2 className="mt-3 text-[36px] font-semibold tracking-tight text-[#0F172A]">
                {card.value}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{card.desc}</p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-slate-600">
                Updated {formatDateOnly(latestAuditDate)}
              </span>

              <span className="text-xs font-medium text-[#163B8C]">
                View Details
              </span>
            </div>

            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#EEF4FF] opacity-0 transition-all duration-300 group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}
