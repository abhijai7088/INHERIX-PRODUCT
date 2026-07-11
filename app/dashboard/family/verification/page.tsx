"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Clock3,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import {
  formatDateTime,
  formatRelationship,
  getInvitationTone,
  getNomineeStatusTone,
} from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

export default function BeneficiaryVerificationPage() {
  const { nominees } = useRecordsStore();
  const stats = useMemo(
    () => ({
      verified: nominees.filter((nominee) => nominee.status === "ACTIVE").length,
      pending: nominees.filter((nominee) => nominee.status === "PENDING_VERIFICATION" || nominee.status === "INVITED").length,
      removed: nominees.filter((nominee) => nominee.status === "REMOVED").length,
    }),
    [nominees]
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Status tracking</Badge>
            <Badge variant="secondary">Nominee lifecycle</Badge>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
              Verification Center
            </p>
            <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[42px]">
              Track nominee status without widening access.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-500 lg:text-base">
              View invitation, verification and active status for each nominee. The owner stays in control and the nominee still cannot browse the vault.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Active</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.verified}</p>
            </div>
            <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.pending}</p>
            </div>
            <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
              <p className="text-sm text-slate-500">Removed</p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.removed}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          "Invitation sent",
          "Acceptance tracked",
          "Verification complete",
        ].map((item) => (
          <Card key={item}>
            <CardContent className="flex items-start gap-3 p-5">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{item}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Status transitions are logged and visible to the owner.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nominee status list</CardTitle>
          <CardDescription>
            Review lifecycle state and open the individual status view when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {nominees.map((nominee) => (
            <Link
              key={nominee.id}
              href={`/dashboard/family/verification/${nominee.id}`}
              className="group flex flex-col gap-4 rounded-[28px] border border-[#DCE3EC] bg-white p-5 transition hover:border-[#163B8C] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-[#0F172A]">{nominee.fullName}</h3>
                  <Badge variant={getNomineeStatusTone(nominee.status)}>{nominee.status}</Badge>
                  <Badge variant={getInvitationTone(nominee.invitationStatus)}>{nominee.invitationStatus}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {formatRelationship(nominee.relationship, nominee.customRelationship)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <Clock3 className="h-3.5 w-3.5" />
                  Updated {formatDateTime(nominee.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-2xl border border-[#DCE3EC] bg-white px-4 py-2 text-sm font-medium text-[#0F172A]">
                  Open status
                </span>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-[#163B8C]" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-[#EEF4FF]">
        <CardContent className="flex items-start gap-4 p-6">
          <UserCheck className="mt-0.5 h-6 w-6 text-[#163B8C]" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Controlled visibility</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The nominee status view helps the owner confirm who is invited, active or removed without granting the nominee broader vault visibility.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
