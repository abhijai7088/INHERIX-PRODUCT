"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Filter,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";
import { formatDateTime, withinDateRange } from "@/lib/records";
import {
  getReleaseStatusLabel,
  getReleaseStatusTone,
} from "@/lib/release-workflow";

export default function ReleaseHistoryPage() {
  const { documentReleases, triggerRequests, nominees, releaseAccessLogs } = useRecordsStore();
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [nomineeFilter, setNomineeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const customers = useMemo(
    () => Array.from(new Set(documentReleases.map((item) => item.customerId))),
    [documentReleases]
  );

  const filteredReleases = useMemo(
    () =>
      [...documentReleases]
        .filter((release) => {
          if (customerFilter !== "all" && release.customerId !== customerFilter) {
            return false;
          }

          if (nomineeFilter !== "all" && release.nomineeId !== nomineeFilter) {
            return false;
          }

          if (statusFilter !== "all" && release.releaseStatus !== statusFilter) {
            return false;
          }

          if (dateFilter !== "all" && !withinDateRange(release.updatedAt, dateFilter as "7d" | "30d" | "90d" | "1y")) {
            return false;
          }

          const needle = query.trim().toLowerCase();
          if (!needle) {
            return true;
          }

          return [
            release.documentTitle,
            release.nomineeName,
            release.releaseNotes,
            release.releasedBy,
            release.releaseStatus,
            triggerRequests.find((item) => item.id === release.triggerRequestId)?.subjectLine ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle);
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [customerFilter, dateFilter, documentReleases, nomineeFilter, query, statusFilter, triggerRequests]
  );

  const recentAccessLogs = useMemo(
    () => [...releaseAccessLogs].sort((left, right) => right.accessedAt.localeCompare(left.accessedAt)).slice(0, 6),
    [releaseAccessLogs]
  );

  const stats = useMemo(
    () => ({
      total: documentReleases.length,
      released: documentReleases.filter((item) => item.releaseStatus === "RELEASED" || item.releaseStatus === "COMPLETED").length,
      revoked: documentReleases.filter((item) => item.releaseStatus === "REVOKED").length,
      pending: documentReleases.filter((item) => item.releaseStatus === "PENDING").length,
    }),
    [documentReleases]
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Release history</Badge>
              <Badge variant="secondary">Immutable trail</Badge>
              <Badge variant="secondary">Operational review</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                Controlled release audit trail
              </p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Review every release action in one place.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                This view shows the complete operational history for document release records, including status changes, notes, and the related trigger case.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Total</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.total}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Released</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.released}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Pending</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.pending}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Revoked</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.revoked}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History filters</CardTitle>
            <CardDescription>
              Narrow the operational trail by customer, nominee, date or status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">Search</label>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Document, nominee, trigger case, notes..."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Customer</label>
                <select
                  value={customerFilter}
                  onChange={(event) => setCustomerFilter(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none"
                >
                  <option value="all">All customers</option>
                  {customers.map((customer) => (
                    <option
                      key={customer}
                      value={customer}
                    >
                      {customer}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Nominee</label>
                <select
                  value={nomineeFilter}
                  onChange={(event) => setNomineeFilter(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none"
                >
                  <option value="all">All nominees</option>
                  {nominees.map((nominee) => (
                    <option
                      key={nominee.id}
                      value={nominee.id}
                    >
                      {nominee.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="RELEASED">Released</option>
                  <option value="REVOKED">Revoked</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Date</label>
                <select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none"
                >
                  <option value="all">All time</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        {filteredReleases.length ? (
          filteredReleases.map((release) => {
            const trigger = triggerRequests.find((item) => item.id === release.triggerRequestId);

            return (
              <Card key={release.id}>
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#0F172A]">{release.documentTitle}</h3>
                        <Badge variant={getReleaseStatusTone(release.releaseStatus)}>
                          {getReleaseStatusLabel(release.releaseStatus)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {release.nomineeName} • {trigger?.subjectLine ?? "Unknown trigger case"}
                      </p>
                      <p className="text-sm leading-6 text-slate-600">{release.releaseNotes}</p>
                    </div>

                    <Button asChild variant="outline">
                      <Link href={`/dashboard/emergency/verification?requestId=${encodeURIComponent(release.triggerRequestId)}`}>
                        Review case
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/releases?requestId=${encodeURIComponent(release.triggerRequestId)}`}>
                        Open center
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                    <div className="rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                      <p className="text-xs text-slate-500">Released by</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{release.releasedBy}</p>
                    </div>
                    <div className="rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                      <p className="text-xs text-slate-500">Released at</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{release.releasedAt ? formatDateTime(release.releasedAt) : "Not released"}</p>
                    </div>
                    <div className="rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                      <p className="text-xs text-slate-500">View / Download</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">
                        {release.canView ? "View" : "No view"} • {release.canDownload ? "Download" : "No download"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                      <p className="text-xs text-slate-500">Updated</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{formatDateTime(release.updatedAt)}</p>
                    </div>
                    <div className="rounded-[20px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
                      <p className="text-xs text-slate-500">Trigger case</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{trigger?.id ?? release.triggerRequestId}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Filter className="mx-auto h-10 w-10 text-[#163B8B]" />
              <p className="mt-4 text-base font-medium text-[#0F172A]">No release history matches your filters</p>
              <p className="mt-2 text-sm text-slate-500">
                Try a broader search or clear one of the filters.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent access activity</CardTitle>
            <CardDescription>Preview and download events are stored as part of the release audit trail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAccessLogs.length ? (
              recentAccessLogs.map((log) => (
                <div key={log.id} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{log.documentTitle}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {log.action === "view" ? "Preview" : "Download"} • {log.actorName ?? "Unknown actor"}
                      </p>
                    </div>
                    <Badge variant={log.action === "view" ? "secondary" : "success"}>
                      {log.action}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{formatDateTime(log.accessedAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                No access events have been recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#EEF4FF]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#163B8B]" />
              <p className="text-sm font-medium text-[#0F172A]">Release governance</p>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Each release record is tied back to an approved trigger case, the owner-defined access rule, and the nominee access log.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="bg-[#EEF4FF]">
        <CardContent className="flex items-start gap-4 p-6">
          <ShieldCheck className="mt-0.5 h-6 w-6 text-[#163B8C]" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Compliance-friendly history</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The release trail is immutable in practice for the app workflow, making it easy to review what was released, when, and under which approved trigger case.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
