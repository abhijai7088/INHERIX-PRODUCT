"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleCheckBig, CircleDashed, Target } from "lucide-react";

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

export default function TasksPage() {
  const { vaults, records, nominees, accessRules, triggerRequests, documentReleases } = useRecordsStore();
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

  const tasks = useMemo<TaskItem[]>(() => {
    const visibleRecords = records.filter((record) => !record.softDeleted);
    const pendingNominees = nominees.filter((nominee) => nominee.status !== "ACTIVE" && nominee.status !== "REMOVED");
    const approvedRequests = triggerRequests.filter((request) => request.status === "APPROVED");
    const releaseCount = documentReleases.filter((release) => release.releaseStatus === "RELEASED" || release.releaseStatus === "COMPLETED").length;
    const canReviewTrigger = role === "VERIFICATION_OFFICER" || role === "ADMIN" || role === "SUPER_ADMIN";
    const canConfigureRelease = role === "ADMIN" || role === "SUPER_ADMIN";

    const items: TaskItem[] = [];

    if (!vaults.length) {
      items.push({
        id: "vault",
        title: "Create Vault",
        description: "Set up a protected continuity vault before uploading records.",
        href: "/dashboard/vault/add",
        priority: "High Priority",
        time: "10 min",
        status: "Pending",
      });
    }

    if (!visibleRecords.length) {
      items.push({
        id: "records",
        title: "Upload a Record",
        description: "Add the first continuity file so the vault has real content.",
        href: "/dashboard/records/add",
        priority: "High Priority",
        time: "15 min",
        status: "Pending",
      });
    }

    if (pendingNominees.length) {
      items.push({
        id: "nominees",
        title: "Review Nominee Invitations",
        description: "Accept, resend, or remove nominee invites that are waiting on the owner flow.",
        href: "/dashboard/family",
        priority: "Medium Priority",
        time: "10 min",
        status: "In Progress",
      });
    }

    if (!accessRules.length) {
      items.push({
        id: "access",
        title: "Create Access Rules",
        description: "Map nominees to categories or documents before any controlled release can happen.",
        href: "/dashboard/connections/access",
        priority: "High Priority",
        time: "15 min",
        status: "Pending",
      });
    }

    if (canReviewTrigger && triggerRequests.some((request) => request.status === "PENDING" || request.status === "UNDER_REVIEW" || request.status === "ADDITIONAL_INFO_REQUIRED")) {
      items.push({
        id: "trigger",
        title: "Review Trigger Workflow",
        description: "Inspect proofs and move approved cases toward selective release.",
        href: "/dashboard/emergency/verification",
        priority: "High Priority",
        time: "20 min",
        status: "In Progress",
      });
    }

    if (canConfigureRelease && approvedRequests.length && releaseCount === 0) {
      items.push({
        id: "release",
        title: "Configure Releases",
        description: "Create selective releases for approved trigger requests.",
        href: "/dashboard/releases",
        priority: "High Priority",
        time: "15 min",
        status: "Pending",
      });
    }

    if (!items.length) {
      items.push({
        id: "all-good",
        title: "Plan Complete",
        description: "The current continuity setup already has vaults, records, nominees, access rules, and release coverage.",
        href: "/dashboard",
        priority: "Low Priority",
        time: "5 min",
        status: "Completed",
      });
    }

    return items;
  }, [accessRules.length, documentReleases, nominees, records, role, triggerRequests, vaults.length]);

  const progress = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "Completed").length;
    return {
      completed,
      inProgress: tasks.filter((task) => task.status === "In Progress").length,
      overall: Math.round((completed / tasks.length) * 100) || 0,
    };
  }, [tasks]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 lg:space-y-8">
      <div className="overflow-hidden rounded-[32px] border border-[#DCE3EC] bg-white">
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-[#EEF4FF] blur-3xl" />
          <div className="relative z-10 flex flex-col gap-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#163B8C]">
                Legacy Planning
              </p>
              <h1 className="mt-4 text-[34px] font-semibold tracking-tight text-[#0F172A] sm:text-[44px]">
                Tasks
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
                Track continuity planning tasks based on the real backend state of your vault, nominees, access rules, and release workflows.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="rounded-[28px] border border-[#EEF2F7] bg-[#FCFCFD] p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Overall Progress</p>
                    <h3 className="mt-3 text-[42px] font-semibold text-[#0F172A]">{progress.overall}%</h3>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF]">
                    <Target className="h-7 w-7 text-[#163B8C]" />
                  </div>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div className="h-full rounded-full bg-[#163B8C]" style={{ width: `${Math.max(progress.overall, 8)}%` }} />
                </div>
              </div>

              <div className="rounded-[28px] border border-[#EEF2F7] bg-[#FCFCFD] p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
                  <CircleDashed className="h-6 w-6 text-amber-700" />
                </div>
                <h3 className="mt-5 text-[42px] font-semibold text-[#0F172A]">{progress.inProgress}</h3>
                <p className="mt-1 text-sm text-slate-500">In Progress</p>
              </div>

              <div className="rounded-[28px] border border-[#EEF2F7] bg-[#FCFCFD] p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                  <CircleCheckBig className="h-6 w-6 text-emerald-700" />
                </div>
                <h3 className="mt-5 text-[42px] font-semibold text-[#0F172A]">{progress.completed}</h3>
                <p className="mt-1 text-sm text-slate-500">Completed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[28px] font-semibold text-[#0F172A]">Next Up</h2>
            <p className="mt-2 text-sm text-slate-500">Continue your priority continuity task.</p>
          </div>

          <Badge variant={tasks[0]?.priority === "High Priority" ? "destructive" : "warning"}>
            {tasks[0]?.priority ?? "Low Priority"}
          </Badge>
        </div>

        {tasks.length ? (
          <Link
            href={tasks[0].href}
            className="group mt-6 flex flex-col gap-5 rounded-[28px] border border-[#DCE3EC] p-5 transition hover:border-[#163B8C] hover:bg-[#F8FBFF] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4FF] transition group-hover:bg-[#163B8C]">
                <CircleCheckBig className="h-7 w-7 text-[#163B8C] group-hover:text-white" />
              </div>
              <div>
                <h3 className="text-[20px] font-semibold text-[#0F172A]">{tasks[0].title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">{tasks[0].description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">{tasks[0].priority}</span>
                  <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#163B8C]">{tasks[0].time}</span>
                </div>
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E2E8F0] transition group-hover:border-[#163B8C] group-hover:bg-[#163B8C]">
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white" />
            </div>
          </Link>
        ) : null}

        <Link
          href="/dashboard/tasks/all"
          className="mt-6 flex h-14 items-center justify-center rounded-2xl bg-[#0F172A] text-sm font-medium text-white transition hover:bg-[#163B8C]"
        >
          View All Tasks
        </Link>
      </div>
    </div>
  );
}
