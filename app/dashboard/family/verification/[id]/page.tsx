"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  FileText,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import {
  formatDateTime,
  formatRelationship,
  getInvitationTone,
  getNomineeById,
  getNomineeStatusTone,
} from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

export default function VerificationDetailPage() {
  const params = useParams<{ id: string }>();
  const nomineeId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const { nominees, audits } = useRecordsStore();
  const nominee = useMemo(() => getNomineeById(nominees, nomineeId), [nominees, nomineeId]);

  const timeline = useMemo(
    () => audits.filter((entry) => entry.subjectId === nomineeId || entry.subjectTitle === nominee?.fullName),
    [audits, nominee?.fullName, nomineeId]
  );

  if (!nominee) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8">
          <p className="text-sm font-medium text-[#163B8C]">Status View</p>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Nominee status not found</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500">
            The selected nominee is not available in the current owner scope.
          </p>
          <Button asChild>
            <Link href="/dashboard/family/verification">
              <ArrowLeft className="h-4 w-4" />
              Back to status list
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="icon">
              <Link href="/dashboard/family/verification">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Badge variant="default">Status detail</Badge>
            <Badge variant={getNomineeStatusTone(nominee.status)}>{nominee.status}</Badge>
            <Badge variant={getInvitationTone(nominee.invitationStatus)}>{nominee.invitationStatus}</Badge>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#EEF4FF] text-xl font-semibold text-[#163B8C]">
                {nominee.fullName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                  Nominee status
                </p>
                <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[42px]">
                  {nominee.fullName}
                </h1>
                <p className="text-sm text-slate-500">
                  {formatRelationship(nominee.relationship, nominee.customRelationship)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href={`/dashboard/family/${nominee.id}`}>
                  <User className="h-4 w-4" />
                  Open nominee
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/dashboard/family/${nominee.id}/access`}>
                  <ShieldCheck className="h-4 w-4" />
                  Manage access
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Status summary</CardTitle>
            <CardDescription>
              Lifecycle states for invitation, acceptance and active status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Invitation sent", value: formatDateTime(nominee.invitedAt) },
              { label: "Accepted", value: nominee.acceptedAt ? formatDateTime(nominee.acceptedAt) : "Not yet accepted" },
              { label: "Removed", value: nominee.removedAt ? formatDateTime(nominee.removedAt) : "Still active in scope" },
              { label: "Relationship", value: formatRelationship(nominee.relationship, nominee.customRelationship) },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4"
              >
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.value}</p>
                </div>
                <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
            <CardDescription>
              Only owner-visible contact data and status metadata.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <Mail className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="mt-1 text-sm text-[#0F172A]">{nominee.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <Phone className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-xs text-slate-500">Mobile</p>
                <p className="mt-1 text-sm text-[#0F172A]">{nominee.mobile}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <Clock3 className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-xs text-slate-500">Updated</p>
                <p className="mt-1 text-sm text-[#0F172A]">{formatDateTime(nominee.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Verification timeline</CardTitle>
            <CardDescription>
              The status flow stays transparent for the owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.length ? (
              timeline.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[24px] border border-[#DCE3EC] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{entry.action}</p>
                      <p className="mt-1 text-sm text-slate-500">{entry.details}</p>
                    </div>
                    <Clock3 className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                No timeline events have been recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope reminder</CardTitle>
            <CardDescription>
              This page reflects status only, not vault access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <FileText className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <p className="text-sm leading-6 text-slate-600">
                Status changes are linked to invitation and ownership controls, not unrestricted document browsing.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              <p className="text-sm leading-6 text-slate-600">
                Use the nominee detail page to manage relationship mapping and access rules if changes are required.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
