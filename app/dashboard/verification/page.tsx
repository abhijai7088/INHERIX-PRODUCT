"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, FileCheck2, FileText, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { getCurrentUser, listTriggerRequests, type TriggerRequest } from "@/lib/trigger-api";

export default function VerificationPage() {
  const [role, setRole] = useState<string | null>(null);
  const [requests, setRequests] = useState<TriggerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        const queue = await listTriggerRequests();
        if (active) {
          setRole(me.user.role);
          setRequests(queue.requests);
        }
      } catch {
        if (active) {
          setRole(null);
          setRequests([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const verificationRoutes = useMemo(
    () => [
      {
        title: "Proof review queue",
        description: "Inspect proofs, request more information, and approve or reject trigger requests.",
        href: "/dashboard/emergency/verification",
      },
      ...(role === "ADMIN" || role === "SUPER_ADMIN"
        ? [
            {
              title: "Controlled release center",
              description: "Release only approved documents after a verified trigger case has passed review.",
              href: "/dashboard/releases",
            },
          ]
        : []),
    ],
    [role]
  );
  const liveStats = useMemo(
    () => ({
      active: requests.filter(
        (request) =>
          request.status === "PENDING" ||
          request.status === "UNDER_REVIEW" ||
          request.status === "ADDITIONAL_INFO_REQUIRED"
      ).length,
      proofUploads: requests.reduce((total, request) => total + request.proofCount, 0),
      linkedDocuments: requests.filter((request) => request.documentId).length,
      completed: requests.filter((request) => request.status === "APPROVED" || request.status === "REJECTED").length,
    }),
    [requests]
  );

  return (
    <main className="space-y-8 px-6 py-8 lg:px-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Verification Center</Badge>
              <Badge variant="secondary">Audited workflow</Badge>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">Controlled operations</p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Review proof, approve triggers, and manage selective release.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                INHERIX keeps trigger verification separate from document release. Use the workflow screens below to move through the audited sequence.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What happens here</CardTitle>
            <CardDescription>Each stage remains scoped, role-aware, and auditable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Proof review is recorded before any approval.",
              "Trigger approval does not automatically release documents.",
              "Releases are document-by-document and can be revoked.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {verificationRoutes.map((item) => (
          <Card key={item.href}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm leading-6 text-slate-600">
                This workflow is backed by production APIs and audit logging.
              </div>
              <Button asChild>
                <Link href={item.href}>
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Active cases",
            value: liveStats.active,
            description: "Requests currently waiting on officer review.",
            icon: ClipboardCheck,
          },
          {
            title: "Nominee proofs",
            value: liveStats.proofUploads,
            description: "Files uploaded as proof across trigger cases.",
            icon: FileText,
          },
          {
            title: "Linked documents",
            value: liveStats.linkedDocuments,
            description: "Cases requesting a specific customer document.",
            icon: FileCheck2,
          },
          {
            title: "Completed outcomes",
            value: liveStats.completed,
            description: "Approved and rejected decisions visible after refresh.",
            icon: CheckCircle2,
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-2xl bg-[#EEF4FF] p-3 text-[#163B8C]">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{item.title}</p>
                <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{loading ? "..." : item.value}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Security posture</CardTitle>
            <CardDescription>Production access is limited to authenticated users with the right role and permission set.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <p className="text-sm leading-6 text-slate-600">
                Verified proofs, controlled releases, and nominee access tickets are all independently logged.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <p className="text-sm leading-6 text-slate-600">
                No automatic full-vault access is ever granted. Every document is handled selectively.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#EEF4FF]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
              <p className="text-sm font-medium text-[#0F172A]">Operational shortcut</p>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              If you are reviewing proof, jump to the queue. If you are handling a release, use the release center.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/emergency/verification">Open proof queue</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
