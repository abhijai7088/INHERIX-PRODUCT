"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, Filter, History, Search, ShieldCheck, Bell, Clock3 } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { EmptyState } from "@/components/inherix/empty-state";
import { Input } from "@/components/inherix/input";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { getEventLog, type EventLogEntry } from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

const domainOptions: Array<EventLogEntry["domain"] | "all"> = ["all", "audit", "security", "notification", "session", "compliance"];

function timelineIcon(domain: EventLogEntry["domain"]) {
  switch (domain) {
    case "security":
      return ShieldCheck;
    case "notification":
      return Bell;
    case "session":
      return Clock3;
    default:
      return History;
  }
}

export default function EventLogPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<EventLogEntry["domain"] | "all">("all");
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const payload = await getEventLog(100);
        if (active) {
          setEvents(payload.events ?? []);
        }
      } catch {
        if (active) {
          setEvents([]);
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
    return events.filter((event) => {
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
        event.details,
        event.device,
        event.location,
        event.type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [domain, events, query]);

  const metrics = useMemo(
    () => ({
      total: visibleEvents.length,
      login: visibleEvents.filter((event) => event.domain === "session").length,
      workflow: visibleEvents.filter((event) => event.domain === "audit" || event.domain === "notification").length,
      compliance: visibleEvents.filter((event) => event.domain === "compliance").length,
    }),
    [visibleEvents]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unified timeline"
        title="Event Log"
        description="A single operational timeline that combines audit, security, notification and compliance events. The record is role-scoped and backend-driven."
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export filtered log
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Visible events", value: metrics.total },
          { label: "Session activity", value: metrics.login },
          { label: "Workflow activity", value: metrics.workflow },
          { label: "Compliance items", value: metrics.compliance },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent>
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-[24px] border border-[#DCE3EC] bg-white px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search entries, actors, subjects, devices or notes"
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
              <div className="rounded-[22px] border border-[#DCE3EC] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Read model</p>
                <p className="mt-2 text-lg font-semibold text-[#0F172A]">Append-only and immutable</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  No secrets, raw tokens or document content are ever written to the log surface.
                </p>
              </div>

              <div className="rounded-[22px] border border-[#DCE3EC] bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Scope</p>
                <p className="mt-2 text-lg font-semibold text-[#0F172A]">Live event feed</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  The backend scopes entries by role so the dashboard can safely render the correct slice.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
              Loading event log...
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Event stream"
              description="Every row is a read-only snapshot of what happened, who acted, where it happened and how the platform responded."
            />

            <div className="space-y-4">
              {visibleEvents.length ? (
                visibleEvents.map((event) => {
                  const Icon = timelineIcon(event.domain);

                  return (
                    <div key={event.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
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
                  title="No events match this filter"
                  description="Try another domain or a broader search term to see the shared log trail."
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Legend"
              description="The log keeps a strict separation between event type, outcome and visibility."
            />

            <div className="space-y-3">
              {[
                {
                  title: "Audit events",
                  text: "Record upload, view, download, access rule and release activity.",
                  icon: History,
                },
                {
                  title: "Security events",
                  text: "Login, password, MFA, device trust and suspicious activity checks.",
                  icon: ShieldCheck,
                },
                {
                  title: "Notification events",
                  text: "Delivery confirmations for workflow, release and security notices.",
                  icon: Bell,
                },
                {
                  title: "Compliance events",
                  text: "Retention packs, policy changes and governance summaries.",
                  icon: Download,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{item.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
