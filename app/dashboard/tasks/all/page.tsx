"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleCheckBig, Clock3, FileCheck2 } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";
import { getCurrentUser } from "@/lib/trigger-api";

type TaskItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: "High Priority" | "Medium Priority" | "Low Priority";
  time: string;
  status: "In Progress" | "Pending" | "Completed";
};

function buildTasks({
  vaults,
  records,
  nominees,
  accessRules,
  triggerRequests,
  documentReleases,
}: ReturnType<typeof useRecordsStore>, role: string | null): TaskItem[] {
  const visibleRecords = records.filter((record) => !record.softDeleted);
  const pendingNominees = nominees.filter((nominee) => nominee.status !== "ACTIVE" && nominee.status !== "REMOVED");
  const approvedRequests = triggerRequests.filter((request) => request.status === "APPROVED");
  const releaseCount = documentReleases.filter((release) => release.releaseStatus === "RELEASED" || release.releaseStatus === "COMPLETED").length;
  const canReviewTrigger = role === "VERIFICATION_OFFICER" || role === "ADMIN" || role === "SUPER_ADMIN";
  const canConfigureRelease = role === "ADMIN" || role === "SUPER_ADMIN";

  const tasks: TaskItem[] = [];

  if (!vaults.length) {
    tasks.push({ id: "vault", title: "Create Vault", description: "Set up a protected continuity vault before uploading records.", href: "/dashboard/vault/add", priority: "High Priority", time: "10 min", status: "Pending" });
  }

  if (!visibleRecords.length) {
    tasks.push({ id: "records", title: "Upload a Record", description: "Add the first continuity file so the vault has real content.", href: "/dashboard/records/add", priority: "High Priority", time: "15 min", status: "Pending" });
  }

  if (pendingNominees.length) {
    tasks.push({ id: "nominees", title: "Review Nominee Invitations", description: "Accept, resend, or remove nominee invites that are waiting on the owner flow.", href: "/dashboard/family", priority: "Medium Priority", time: "10 min", status: "In Progress" });
  }

  if (!accessRules.length) {
    tasks.push({ id: "access", title: "Create Access Rules", description: "Map nominees to categories or documents before any controlled release can happen.", href: "/dashboard/connections/access", priority: "High Priority", time: "15 min", status: "Pending" });
  }

  if (canReviewTrigger && triggerRequests.some((request) => request.status === "PENDING" || request.status === "UNDER_REVIEW" || request.status === "ADDITIONAL_INFO_REQUIRED")) {
    tasks.push({ id: "trigger", title: "Review Trigger Workflow", description: "Inspect proofs and move approved cases toward selective release.", href: "/dashboard/emergency/verification", priority: "High Priority", time: "20 min", status: "In Progress" });
  }

  if (canConfigureRelease && approvedRequests.length && releaseCount === 0) {
    tasks.push({ id: "release", title: "Configure Releases", description: "Create selective releases for approved trigger requests.", href: "/dashboard/releases", priority: "High Priority", time: "15 min", status: "Pending" });
  }

  if (!tasks.length) {
    tasks.push({ id: "all-good", title: "Plan Complete", description: "The current continuity setup already has vaults, records, nominees, access rules, and release coverage.", href: "/dashboard", priority: "Low Priority", time: "5 min", status: "Completed" });
  }

  return tasks;
}

export default function AllTasksPage() {
  const store = useRecordsStore();
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

  const tasks = useMemo(() => buildTasks(store, role), [role, store]);
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const inProgress = tasks.filter((task) => task.status === "In Progress").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#163B8C]">Legacy Planning</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[38px]">All Tasks</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
            Track and manage all continuity planning activities securely using real backend state.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 text-center shadow-sm">
            <p className="text-xs text-slate-500">In Progress</p>
            <h3 className="mt-2 text-2xl font-semibold text-[#0F172A]">{inProgress}</h3>
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 text-center shadow-sm">
            <p className="text-xs text-slate-500">Completed</p>
            <h3 className="mt-2 text-2xl font-semibold text-[#0F172A]">{completed}</h3>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <Badge variant="default">All</Badge>
        <Badge variant="secondary">In Progress</Badge>
        <Badge variant="secondary">Completed</Badge>
      </div>

      <div className="grid gap-4">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={task.href}
            className="group rounded-[30px] border border-[#DCE3EC] bg-white p-5 shadow-sm transition-all duration-200 hover:border-[#163B8C] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] transition group-hover:bg-[#163B8C]">
                  {task.status === "Completed" ? (
                    <CircleCheckBig className="h-6 w-6 text-[#163B8C] group-hover:text-white" />
                  ) : (
                    <FileCheck2 className="h-6 w-6 text-[#163B8C] group-hover:text-white" />
                  )}
                </div>

                <div>
                  <h3 className="text-[17px] font-semibold text-[#0F172A]">{task.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{task.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${task.priority === "High Priority" ? "bg-red-100 text-red-700" : task.priority === "Medium Priority" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                      {task.priority}
                    </span>
                    <div className="flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-slate-600">
                      <Clock3 className="h-3.5 w-3.5" />
                      {task.time}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${task.status === "Completed" ? "bg-emerald-100 text-emerald-700" : task.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white transition group-hover:border-[#163B8C] group-hover:bg-[#163B8C]">
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
