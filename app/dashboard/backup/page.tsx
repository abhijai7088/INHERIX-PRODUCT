"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, HardDriveUpload, Search, ShieldCheck, Clock3 } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { EmptyState } from "@/components/inherix/empty-state";
import { Input } from "@/components/inherix/input";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { downloadAuditLogsExport, getBackupSnapshot, type BackupPayload } from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

const kindOptions: Array<BackupPayload["artifacts"][number]["type"] | "all"> = ["all", "backup", "export"];
const formatOptions: Array<BackupPayload["artifacts"][number]["format"] | "all"> = ["all", "ZIP", "PDF", "CSV", "JSON"];

function kindTone(kind: BackupPayload["artifacts"][number]["type"]) {
  return kind === "backup" ? "default" as const : "secondary" as const;
}

function statusTone(status: BackupPayload["artifacts"][number]["status"]) {
  if (status === "ready") return "success" as const;
  if (status === "scheduled") return "secondary" as const;
  if (status === "pending") return "warning" as const;
  return "destructive" as const;
}

export default function BackupPage() {
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<BackupPayload["artifacts"][number]["type"] | "all">("all");
  const [format, setFormat] = useState<BackupPayload["artifacts"][number]["format"] | "all">("all");
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBackupSnapshot();
        if (active) {
          setPayload(data);
        }
      } catch {
        if (active) {
          setPayload(null);
          setError("Unable to load the live backup ledger right now.");
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

  const visibleArtifacts = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return (payload?.artifacts ?? []).filter((artifact) => {
      if (kind !== "all" && artifact.type !== kind) return false;
      if (format !== "all" && artifact.format !== format) return false;
      if (!needle) return true;

      return [artifact.title, artifact.generatedBy, artifact.retention, artifact.status, artifact.source, artifact.format]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [format, kind, payload, query]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Backup / Export"
          description="A live retention and export ledger for the admin console."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading backup ledger...
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
          title="Backup / Export"
          description="A live retention and export ledger for the admin console."
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

  async function handleAuditExport() {
    setDownloading(true);
    try {
      const csv = await downloadAuditLogsExport();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "inherix-audit-export.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Backup / Export"
        description="A live retention and export ledger. It reflects the current readiness posture, the audit export path and the exportable compliance artifacts."
        actions={
          <Button variant="outline" size="sm" onClick={() => void handleAuditExport()} disabled={downloading || loading}>
            <HardDriveUpload className="h-4 w-4" />
            {downloading ? "Preparing export..." : "Export audit CSV"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Schedule", value: payload?.schedule ?? "Daily", detail: "Operational backup cadence", icon: Clock3 },
          { label: "Retention", value: payload?.retention ?? "365 days", detail: "Policy enforced window", icon: ShieldCheck },
          { label: "Artifacts", value: payload?.artifacts.length ?? 0, detail: "Live exportable records", icon: FileText },
          { label: "Readiness", value: payload?.readiness.status === "ready" ? "Ready" : "Review", detail: "Runtime posture", icon: Download },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="space-y-5">
          <SectionHeader
            title="Controls"
            description="The page filters the live artifact ledger and the export actions use the real audit export endpoint."
          />

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {kindOptions.map((option) => (
                  <Button key={option} type="button" variant={kind === option ? "primary" : "outline"} size="sm" onClick={() => setKind(option)}>
                    {option === "all" ? "All jobs" : option}
                  </Button>
                ))}
                {formatOptions.map((option) => (
                  <Button key={option} type="button" variant={format === option ? "primary" : "outline"} size="sm" onClick={() => setFormat(option)}>
                    {option === "all" ? "All formats" : option}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-3 rounded-[24px] border border-[#DCE3EC] bg-white px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search titles, owners, status or retention"
                  className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Backup posture", text: "Daily backups are documented even when the store is still converging.", icon: ShieldCheck },
                { title: "Audit export", text: "Exports are generated from the live audit ledger with signed delivery.", icon: Download },
                { title: "Retention windows", text: "Each artifact carries the current policy window and status.", icon: Clock3 },
                { title: "Readiness", text: "Storage, signing and notifications are surfaced explicitly.", icon: FileText },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-[#0F172A]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Backup and export ledger"
              description="Live artifact records surfaced from the backend control plane."
            />

            <div className="space-y-4">
              {loading ? (
                <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                  Loading backup snapshot...
                </div>
              ) : visibleArtifacts.length ? (
                visibleArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-[#0F172A]">{artifact.title}</h3>
                          <Badge variant={kindTone(artifact.type)}>{artifact.type}</Badge>
                          <Badge variant={statusTone(artifact.status)}>{artifact.status}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-500">
                          Generated by {artifact.generatedBy} - {artifact.format} - {artifact.source}
                        </p>
                        <p className="text-sm leading-6 text-slate-500">Retention: {artifact.retention}</p>
                        <p className="text-sm leading-6 text-slate-500">{formatDateTime(artifact.createdAt)}</p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge variant={artifact.downloadStatus === "signed" || artifact.downloadStatus === "authenticated" ? "success" : artifact.downloadStatus === "pending" ? "warning" : "secondary"}>
                          {artifact.downloadStatus}
                        </Badge>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleAuditExport()}>
                          <Download className="h-4 w-4" />
                          Export audit CSV
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No artifacts match the current filters" description="Broaden the backup or export filters to see live records." />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Retention policy"
                description="Policy controls for operational artifacts and exported reports."
              />

              <div className="space-y-3">
                {[
                  "Daily backups remain the documented baseline for continuity posture.",
                  "Exports are signed or authenticated according to the live storage readiness state.",
                  "No raw secrets, encryption keys or private credentials are shown in the artifact ledger.",
                  "Every generation and download event remains available to the audit trail.",
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                    <p className="text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Readiness"
                description="The control plane surfaces the current deployment blockers and signed-download posture."
              />

              <div className="space-y-3">
                {[
                  { label: "Database", value: payload?.readiness.databaseConfigured ? "Ready" : "Missing" },
                  { label: "Storage", value: payload?.readiness.storageConfigured ? "Ready" : "Missing" },
                  { label: "Signing", value: payload?.readiness.signingConfigured ? "Ready" : "Missing" },
                  { label: "KMS", value: payload?.readiness.kmsConfigured ? "Ready" : "Missing" },
                  { label: "Notifications", value: payload?.readiness.notificationsConfigured ? "Ready" : "Missing" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-[22px] border border-[#E5ECF5] bg-white px-4 py-3">
                    <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                    <Badge variant={item.value === "Ready" ? "success" : "warning"}>{item.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Audit trail"
                description="Recent backup-related events pulled from the live audit stream."
              />

              <div className="space-y-3">
                {(payload?.auditTrail ?? []).map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</p>
                        <p className="mt-2 text-xs text-slate-500">{item.actor} - {formatDateTime(item.occurredAt)}</p>
                      </div>
                      <Badge variant="secondary">{item.domain}</Badge>
                    </div>
                  </div>
                ))}
                {!(payload?.auditTrail?.length) ? (
                  <div className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-slate-500">
                    No backup-related audit events are available yet.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
