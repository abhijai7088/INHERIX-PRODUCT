"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileText, Search, ShieldCheck, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { EmptyState } from "@/components/inherix/empty-state";
import { Input } from "@/components/inherix/input";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { getAdminReports, type AdminReportsPayload } from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

type ReportTab = "trigger" | "release" | "audit";
type TriggerRow = AdminReportsPayload["triggerReport"]["rows"][number];
type ReleaseRow = AdminReportsPayload["releaseReport"]["rows"][number];
type AuditRow = AdminReportsPayload["auditReport"]["rows"][number];
const tabOptions: Array<{ id: ReportTab; label: string; description: string }> = [
  { id: "trigger", label: "Trigger report", description: "Request status, priority and customer scope" },
  { id: "release", label: "Release report", description: "Nominee, document and release posture" },
  { id: "audit", label: "Audit report", description: "User, module and action timeline" },
];

const windowOptions = ["7d", "30d", "90d"] as const;

function withinWindow(dateValue: string | null | undefined, window: (typeof windowOptions)[number]) {
  if (!dateValue) return true;
  const createdAt = new Date(dateValue).getTime();
  if (Number.isNaN(createdAt)) return true;
  const now = Date.now();
  const thresholdDays = window === "7d" ? 7 : window === "30d" ? 30 : 90;
  return now - createdAt <= thresholdDays * 24 * 60 * 60 * 1000;
}

function csvEscape(value: unknown) {
  const normalized = value == null ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reportTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("high") || normalized.includes("critical") || normalized.includes("reject")) return "destructive" as const;
  if (normalized.includes("medium") || normalized.includes("review") || normalized.includes("pending")) return "warning" as const;
  if (normalized.includes("approved") || normalized.includes("released") || normalized.includes("success")) return "success" as const;
  return "secondary" as const;
}

export default function ReportsPage() {
  const [payload, setPayload] = useState<AdminReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportTab>("trigger");
  const [search, setSearch] = useState("");
  const [windowRange, setWindowRange] = useState<(typeof windowOptions)[number]>("30d");
  const [triggerStatus, setTriggerStatus] = useState<string>("all");
  const [triggerCustomer, setTriggerCustomer] = useState("");
  const [releaseNominee, setReleaseNominee] = useState("");
  const [auditModule, setAuditModule] = useState("");
  const [auditUser, setAuditUser] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminReports();
        if (active) {
          setPayload(data);
        }
      } catch {
        if (active) {
          setPayload(null);
          setError("Unable to load the live report ledger right now.");
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

  const reportView = useMemo(() => {
    const triggerRows = payload?.triggerReport.rows ?? [];
    const releaseRows = payload?.releaseReport.rows ?? [];
    const auditRows = payload?.auditReport.rows ?? [];
    const needle = search.trim().toLowerCase();

    const filteredTriggers = triggerRows.filter((row) => {
      if (triggerStatus !== "all" && row.status !== triggerStatus) return false;
      if (triggerCustomer.trim() && !`${row.customerId}`.toLowerCase().includes(triggerCustomer.trim().toLowerCase())) return false;
      if (!withinWindow(row.latestActivityAt ?? row.createdAt, windowRange)) return false;
      if (!needle) return true;
      return [
        row.subjectLine,
        row.nomineeName,
        row.customerId,
        row.requestKind,
        row.status,
        row.priority,
        row.adminDecisionNote ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const filteredReleases = releaseRows.filter((row) => {
      if (releaseNominee.trim() && !row.nomineeName.toLowerCase().includes(releaseNominee.trim().toLowerCase())) return false;
      if (!withinWindow(row.releasedAt ?? row.createdAt, windowRange)) return false;
      if (!needle) return true;
      return [
        row.documentTitle,
        row.nomineeName,
        row.categoryName,
        row.releaseStatus,
        row.releasedBy ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const filteredAudit = auditRows.filter((row) => {
      if (auditModule.trim() && !(row.moduleName ?? "").toLowerCase().includes(auditModule.trim().toLowerCase())) return false;
      if (auditUser.trim() && !(row.actor ?? "").toLowerCase().includes(auditUser.trim().toLowerCase())) return false;
      if (!withinWindow(row.occurredAt, windowRange)) return false;
      if (!needle) return true;
      return [row.title, row.summary, row.actor, row.subject, row.details, row.domain, row.type]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    return {
      triggerRows: filteredTriggers,
      releaseRows: filteredReleases,
      auditRows: filteredAudit,
    };
  }, [auditModule, auditUser, payload, releaseNominee, search, tab, triggerCustomer, triggerStatus, windowRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Operational Reports"
          description="Live trigger, release and audit reports for the admin console."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading report ledger...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Operational Reports"
          description="Live trigger, release and audit reports for the admin console."
        />
        <Card className="border-[#F2C9C9] bg-[#FFF7F7]">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold text-[#7F1D1D]">Live data unavailable</p>
            <p className="text-sm leading-6 text-[#991B1B]">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleExport() {
    setDownloading(true);
    try {
      if (tab === "audit") {
        downloadCsv(
          "inherix-audit-report.csv",
          reportView.auditRows.map((row) => ({
            id: row.id,
            occurredAt: row.occurredAt,
            actor: row.actor,
            actorRole: row.actorRole ?? "",
            domain: row.domain,
            moduleName: row.moduleName ?? "",
            type: row.type,
            title: row.title,
            summary: row.summary,
            subject: row.subject,
            details: row.details,
            outcome: row.outcome,
            severity: row.severity,
          }))
        );
        return;
      }

      if (tab === "trigger") {
        downloadCsv(
          "inherix-trigger-report.csv",
          reportView.triggerRows.map((row) => ({
            id: row.id,
            customerId: row.customerId,
            nomineeName: row.nomineeName,
            requestKind: row.requestKind,
            subjectLine: row.subjectLine,
            priority: row.priority,
            status: row.status,
            latestActivityAt: row.latestActivityAt,
            reviewedAt: row.reviewedAt ?? "",
            resolvedAt: row.resolvedAt ?? "",
            adminDecisionNote: row.adminDecisionNote ?? "",
          }))
        );
        return;
      }

      downloadCsv(
        "inherix-release-report.csv",
        reportView.releaseRows.map((row) => ({
          id: row.id,
          nomineeName: row.nomineeName,
          documentTitle: row.documentTitle,
          categoryName: row.categoryName,
          releaseStatus: row.releaseStatus,
          canView: row.canView,
          canDownload: row.canDownload,
          releasedBy: row.releasedBy ?? "",
          releasedAt: row.releasedAt ?? "",
        }))
      );
    } finally {
      setDownloading(false);
    }
  }

  const rowCount = tab === "trigger" ? reportView.triggerRows.length : tab === "release" ? reportView.releaseRows.length : reportView.auditRows.length;
  const summary = {
    trigger: payload?.triggerReport.rows.length ?? 0,
    release: payload?.releaseReport.rows.length ?? 0,
    audit: payload?.auditReport.rows.length ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Operational Reports"
        description="The live reporting workspace for trigger, release and audit records. Filters are applied to backend data instead of local fixtures."
        actions={
          <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={loading || downloading || !rowCount}>
            <Download className="h-4 w-4" />
            {downloading ? "Preparing export..." : "Export current view"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Trigger rows", value: summary.trigger, icon: FileText },
          { label: "Release rows", value: summary.release, icon: ShieldCheck },
          { label: "Audit rows", value: summary.audit, icon: ShieldAlert },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-[#DCE3EC] bg-white">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Operator links</p>
            <p className="text-sm leading-6 text-slate-600">
              Jump from reporting into the live workflow screens when you need to review a request or finish a release.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/emergency/verification">Review triggers</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/releases">Manage releases</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="space-y-5">
          <SectionHeader
            title="Report selector"
            description="Choose a live report, then filter by status, nominee, customer, user or module."
          />

          <div className="flex flex-wrap gap-2">
            {tabOptions.map((option) => (
              <Button key={option.id} type="button" variant={tab === option.id ? "primary" : "outline"} size="sm" onClick={() => setTab(option.id)}>
                {option.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-[24px] border border-[#DCE3EC] bg-white px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search across the active report"
                  className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {windowOptions.map((option) => (
                  <Button key={option} type="button" variant={windowRange === option ? "primary" : "outline"} size="sm" onClick={() => setWindowRange(option)}>
                    Last {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {tab === "trigger" ? (
                <>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Status</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["all", "PENDING", "APPROVED", "REJECTED", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED"].map((option) => (
                        <Button key={option} type="button" variant={triggerStatus === option ? "primary" : "outline"} size="sm" onClick={() => setTriggerStatus(option)}>
                          {option === "all" ? "All" : option}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Customer</p>
                    <Input value={triggerCustomer} onChange={(event) => setTriggerCustomer(event.target.value)} placeholder="Customer id" className="mt-3" />
                  </div>
                </>
              ) : null}

              {tab === "release" ? (
                <>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Nominee</p>
                    <Input value={releaseNominee} onChange={(event) => setReleaseNominee(event.target.value)} placeholder="Nominee name" className="mt-3" />
                  </div>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Format</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="default">PDF</Badge>
                      <Badge variant="secondary">CSV</Badge>
                      <Badge variant="secondary">Excel</Badge>
                    </div>
                  </div>
                </>
              ) : null}

              {tab === "audit" ? (
                <>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Module</p>
                    <Input value={auditModule} onChange={(event) => setAuditModule(event.target.value)} placeholder="e.g. security, rbac, release" className="mt-3" />
                  </div>
                  <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">User</p>
                    <Input value={auditUser} onChange={(event) => setAuditUser(event.target.value)} placeholder="Actor name" className="mt-3" />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title={`${tabOptions.find((option) => option.id === tab)?.label ?? "Report"} results`}
              description="Rows are pulled from the live backend snapshot and filtered in place."
            />

            <div className="space-y-4">
              {loading ? (
                <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                  Loading reports...
                </div>
              ) : rowCount ? (
                tab === "trigger"
                  ? reportView.triggerRows.map((row: TriggerRow) => {
                      return (
                        <div key={row.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-[#0F172A]">{row.subjectLine}</h3>
                                <Badge variant={reportTone(row.priority)}>{row.priority}</Badge>
                                <Badge variant={reportTone(row.status)}>{row.status}</Badge>
                              </div>
                              <p className="text-sm leading-6 text-slate-500">
                                Nominee {row.nomineeName} - Customer {row.customerId}
                              </p>
                              <p className="text-sm leading-6 text-slate-500">{row.requestKind} - {row.summary || "No summary supplied."}</p>
                              <p className="text-xs text-slate-500">
                                Last activity {formatDateTime(row.latestActivityAt)}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <span className="text-xs text-slate-500">{row.adminDecisionNote ? "Reviewed" : "Unreviewed"}</span>
                              <Button type="button" size="sm" variant="outline" onClick={() => void handleExport()}>
                                <Download className="h-4 w-4" />
                                Export CSV
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  : tab === "release"
                    ? reportView.releaseRows.map((row: ReleaseRow) => {
                        return (
                          <div key={row.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-[#0F172A]">{row.documentTitle}</h3>
                                  <Badge variant={reportTone(row.releaseStatus)}>{row.releaseStatus}</Badge>
                                  <Badge variant={row.canDownload ? "success" : "secondary"}>{row.canDownload ? "download" : "view only"}</Badge>
                                </div>
                                <p className="text-sm leading-6 text-slate-500">
                                  {row.nomineeName} - {row.categoryName}
                                </p>
                                <p className="text-sm leading-6 text-slate-500">
                                  Released by {row.releasedBy ?? "System"} - {row.releasedAt ? formatDateTime(row.releasedAt) : "Pending"}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <span className="text-xs text-slate-500">{row.fileName ?? "Encrypted file"}</span>
                                <Button type="button" size="sm" variant="outline" onClick={() => void handleExport()}>
                                  <Download className="h-4 w-4" />
                                  Export CSV
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    : reportView.auditRows.map((row: AuditRow) => {
                        return (
                          <div key={row.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-[#0F172A]">{row.title}</h3>
                                  <Badge variant={reportTone(row.severity)}>{row.severity}</Badge>
                                  <Badge variant={reportTone(row.outcome)}>{row.outcome}</Badge>
                                </div>
                                <p className="text-sm leading-6 text-slate-500">{row.summary}</p>
                                <p className="text-sm leading-6 text-slate-500">
                                  {row.actor} - {row.moduleName ?? row.domain}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <span className="text-xs text-slate-500">{formatDateTime(row.occurredAt)}</span>
                                <Button type="button" size="sm" variant="outline" onClick={() => void handleExport()}>
                                  <Download className="h-4 w-4" />
                                  Export CSV
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
              ) : (
                <EmptyState title="No rows found" description="Adjust the filters to surface live report data." />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Source and export notes"
                description="The live backend now powers the report grid and the audit export route."
              />

              <div className="space-y-3">
                {[
                  "Trigger, release and audit rows are fetched from the control plane and filtered locally for quick review.",
                  "The admin dashboard uses the backend CSV route for the audit ledger; this page exports the current filtered view directly.",
                  "PDF and Excel renderers are not wired in this build, so the UI keeps the export path honest by offering CSV output today.",
                  "Every report row carries its current live timestamp and status from the backend ledger.",
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Available formats"
                description="The backend exposes the formats documented for each report family."
              />

              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Set([
                    ...(payload?.triggerReport.availableFormats ?? []),
                    ...(payload?.releaseReport.availableFormats ?? []),
                    ...(payload?.auditReport.availableFormats ?? []),
                  ])
                ).map((format) => (
                  <Badge key={format} variant={format === "CSV" ? "success" : "secondary"}>
                    {format}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
