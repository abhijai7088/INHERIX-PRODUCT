"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock3, CircleCheckBig, ShieldCheck } from "lucide-react";

import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";
import { getCurrentUser } from "@/lib/trigger-api";

function buildTasks(store: ReturnType<typeof useRecordsStore>, role: string | null) {
  const { vaults, records, nominees, accessRules, triggerRequests, documentReleases } = store;
  const visibleRecords = records.filter((record) => !record.softDeleted);
  const pendingNominees = nominees.filter((nominee) => nominee.status !== "ACTIVE" && nominee.status !== "REMOVED");
  const approvedRequests = triggerRequests.filter((request) => request.status === "APPROVED");
  const releaseCount = documentReleases.filter((release) => release.releaseStatus === "RELEASED" || release.releaseStatus === "COMPLETED").length;
  const canReviewTrigger = role === "VERIFICATION_OFFICER" || role === "ADMIN" || role === "SUPER_ADMIN";
  const canConfigureRelease = role === "ADMIN" || role === "SUPER_ADMIN";

  const tasks = [];

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

export default function TaskDetailPage() {
  const params = useParams<{ id?: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id;
  const store = useRecordsStore();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        if (active) {
          setRole(me.user.role);
          setRoleLoading(false);
        }
      } catch {
        if (active) {
          setRole(null);
          setRoleLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const task = useMemo(() => buildTasks(store, role).find((item) => item.id === taskId) ?? null, [store, taskId, role]);

  if (!taskId) {
    notFound();
  }

  if (roleLoading) {
    return (
      <Card className="mx-auto max-w-[900px]">
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-slate-500">Loading task details...</p>
        </CardContent>
      </Card>
    );
  }

  if (!task) {
    return (
      <Card className="mx-auto max-w-[900px]">
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-slate-500">This task is no longer available as a standalone item.</p>
          <Button asChild>
            <Link href="/dashboard/tasks">Return to tasks</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/dashboard/tasks" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#163B8C]">
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Link>

          <h1 className="mt-4 text-[34px] font-semibold tracking-tight text-[#0F172A] sm:text-[44px]">{task.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-4 py-2 text-xs font-medium ${task.priority === "High Priority" ? "bg-red-100 text-red-700" : task.priority === "Medium Priority" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
              {task.priority}
            </span>
            <span className="flex items-center gap-2 rounded-full bg-[#EEF4FF] px-4 py-2 text-xs font-medium text-[#163B8C]">
              <Clock3 className="h-4 w-4" />
              {task.time}
            </span>
          </div>
        </div>

        <Button asChild>
          <Link href={task.href}>
            <CheckCircle2 className="h-5 w-5" />
            Open workflow
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4FF]">
                <ShieldCheck className="h-6 w-6 text-[#163B8C]" />
              </div>
              <div>
                <h2 className="text-[24px] font-semibold text-[#0F172A]">Why is this important?</h2>
                <p className="mt-4 text-sm leading-8 text-slate-500 sm:text-base">{task.description}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6 sm:p-7">
            <h2 className="text-[24px] font-semibold text-[#0F172A]">What you&apos;ll need</h2>
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-4 rounded-[24px] border border-[#EEF2F7] bg-[#FCFCFD] p-5">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF]">
                  <CircleCheckBig className="h-5 w-5 text-[#163B8C]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#0F172A]">Current state</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">This task is derived from live dashboard state and updates as the backend changes.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-[24px] border border-[#EEF2F7] bg-[#FCFCFD] p-5">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF]">
                  <CircleCheckBig className="h-5 w-5 text-[#163B8C]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#0F172A]">Target workflow</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">Open the real backend-backed screen that resolves this task.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Task Status</p>
                <h3 className="mt-2 text-[32px] font-semibold text-[#0F172A]">{task.status}</h3>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                <Clock3 className="h-7 w-7 text-amber-700" />
              </div>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div className="h-full w-[60%] rounded-full bg-[#163B8C]" />
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-500">You&apos;re currently working on this continuity planning task.</p>
          </div>

          <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-6">
            <h2 className="text-[22px] font-semibold text-[#0F172A]">Next Task</h2>
            <Link href={task.href} className="group mt-5 flex items-center justify-between rounded-[24px] border border-[#E2E8F0] p-4 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]">
              <div>
                <h3 className="text-[16px] font-semibold text-[#0F172A]">{task.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{task.priority} • {task.time}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-[#163B8C]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
