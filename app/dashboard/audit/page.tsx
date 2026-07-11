"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, Filter, FileText, History, Search, ShieldCheck, Clock3, Lock } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { EmptyState } from "@/components/inherix/empty-state";
import { Input } from "@/components/inherix/input";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { getAuditLogs, type AuditLogsPayload, type ComplianceReport } from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

const domainOptions = ["all", "audit", "security", "notification", "session", "compliance"] as const;

function eventIcon(domain: (typeof domainOptions)[number]) {
  switch (domain) {
    case "security":
      return ShieldCheck;
    case "notification":
      return FileText;
    case "session":
      return Clock3;
    case "compliance":
      return Download;
    default:
      return History;
  }
}

export default function AuditCenterPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<(typeof domainOptions)[number]>("all");
  const [payload, setPayload] = useState<AuditLogsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const next = await getAuditLogs(100);
        if (active) {
          setPayload(next);
        }
      } catch {
        if (active) {
          setPayload(null);
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

  const visibleEvents = useMemo(() => {
    const logs = payload?.logs ?? [];
    return logs.filter((event) => {
      if (domain !== "all" && event.domain !== domain) {
        return false;
      }

      const needle = query.trim().toLowerCase();
      if (!needle) {
        return true;
      }

      return [
        event.title,
        event.summary,
        event.actor,
        event.subject,
        event.device,
        event.location,
        event.details,
        event.moduleName ?? "",
        event.entityType ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [domain, payload?.logs, query]);

  const complianceReports = payload?.complianceReports ?? [];

  const stats = useMemo(() => {
    return {
      total: visibleEvents.length,
      security: visibleEvents.filter((item) => item.domain === "security").length,
      audit: visibleEvents.filter((item) => item.domain === "audit").length,
      compliance: visibleEvents.filter((item) => item.domain === "compliance").length,
    };
  }, [visibleEvents]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security & Governance"
        title="Audit Center"
        description="Append-only continuity records with controlled visibility. The audit center now reflects the live backend ledger and compliance snapshot."
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export redacted trail
          </Button>
        }
      />

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[24px] border border-[#DCE3EC] bg-white px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search audit entries, actors, documents or notes"
                className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-[#163B8C]" />
              <span className="text-sm font-medium text-slate-500">Domain</span>
              {domainOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={domain === option ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setDomain(option)}
                >
                  {option === "all" ? "All domains" : option}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Visible to</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">Admin and super admin</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                The audit center stays role-scoped and only surfaces the backend-ledger view for authorised operators.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Compliance window</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">7 year retention</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Audit exports remain redacted and derived from the live append-only ledger.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Audit events", value: stats.total, icon: History },
          { label: "Security events", value: stats.security, icon: ShieldCheck },
          { label: "Workflow events", value: stats.audit, icon: FileText },
          { label: "Compliance exports", value: stats.compliance, icon: Download },
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

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Append-only ledger"
              description="Every row captures the actor, subject, outcome and the minimum necessary metadata. The content is read-only."
              action={
                <div className="flex items-center gap-2 rounded-full bg-[#F8FBFF] px-3 py-2 text-xs font-medium text-slate-500">
                  <Filter className="h-3.5 w-3.5 text-[#163B8C]" />
                  {domain === "all" ? "All domains" : domain}
                </div>
              }
            />

            <div className="space-y-4">
              {loading ? (
                <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                  Loading audit ledger...
                </div>
              ) : visibleEvents.length ? (
                visibleEvents.map((event) => {
                  const Icon = eventIcon(event.domain);

                  return (
                    <div
                      key={event.id}
                      className="rounded-[24px] border border-[#E5ECF5] bg-white p-5 transition hover:border-[#C9D8EF]"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-[#0F172A]">{event.title}</h3>
                              <Badge
                                variant={
                                  event.outcome === "success"
                                    ? "success"
                                    : event.outcome === "warning"
                                      ? "warning"
                                      : event.outcome === "failure"
                                        ? "destructive"
                                        : "secondary"
                                }
                              >
                                {event.outcome}
                              </Badge>
                              <Badge
                                variant={
                                  event.severity === "critical"
                                    ? "destructive"
                                    : event.severity === "high"
                                      ? "warning"
                                      : event.severity === "medium"
                                        ? "secondary"
                                        : "default"
                                }
                              >
                                {event.severity}
                              </Badge>
                            </div>

                            <p className="max-w-3xl text-sm leading-6 text-slate-500">{event.summary}</p>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{event.actor}</span>
                              <span aria-hidden="true">•</span>
                              <span>{event.subject}</span>
                              <span aria-hidden="true">•</span>
                              <span>{event.device}</span>
                              <span aria-hidden="true">•</span>
                              <span>{event.location}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                          <CalendarRange className="h-4 w-4 text-[#163B8C]" />
                          {formatDateTime(event.occurredAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="No audit entries match this view"
                  description="Try a different domain or relax the search term to see the shared log trail."
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Compliance exports"
                description="Redacted packs prepared for oversight and retention, never raw vault data."
              />

              <div className="space-y-3">
                {complianceReports.map((report: ComplianceReport) => (
                  <div
                    key={report.id}
                    className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{report.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{report.description}</p>
                      </div>
                      <Badge variant={report.format === "PDF" ? "default" : "secondary"}>{report.format}</Badge>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <p>{report.scope}</p>
                      <p>Retention: {report.retention}</p>
                      <p>Generated by {report.generatedBy}</p>
                      <p>{formatDateTime(report.generatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Controls"
                description="Audit surface remains locked down unless the workflow explicitly allows a change."
              />

              <div className="space-y-3">
                {[
                  "Login activity, failed logins, password and MFA changes",
                  "New devices, session starts and session revocations",
                  "Document upload, view, download, trigger and release events",
                  "Notification delivery, compliance exports and suspicious activity",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-[20px] border border-[#E5ECF5] p-4">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF4FF] text-[#163B8C]">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4" />
                Review access scope
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
