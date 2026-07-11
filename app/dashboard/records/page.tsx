"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileText,
  FolderLock,
  HeartHandshake,
  Landmark,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import {
  formatBytes,
  formatDateOnly,
  formatDateTime,
  getRecordCategory,
  getRecordVaultName,
  getVaultRecordCount,
  recordCategories,
} from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

const categoryIcons = {
  "financial-information": Landmark,
  "legal-documents": ShieldCheck,
  "personal-information": FileText,
  "family-assets": HeartHandshake,
  "business-records": Briefcase,
};

export default function RecordsPage() {
  const { vaults, records, audits, createVault } = useRecordsStore();
  const [vaultName, setVaultName] = useState("");
  const [vaultDescription, setVaultDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const visibleRecords = useMemo(
    () => records.filter((record) => !record.softDeleted),
    [records]
  );

  const categorySummary = useMemo(
    () =>
      recordCategories.map((category) => {
        const items = visibleRecords.filter((record) => record.categorySlug === category.slug);
        return {
          ...category,
          count: items.length,
          latest: items[0],
        };
      }),
    [visibleRecords]
  );

  const recentRecords = useMemo(
    () => [...visibleRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
    [visibleRecords]
  );

  const recentAudits = useMemo(
    () => [...audits].slice(0, 5),
    [audits]
  );

  const vaultStats = useMemo(
    () => vaults.map((vault) => ({
      ...vault,
      recordCount: getVaultRecordCount(vaults, visibleRecords, vault.id),
      latestRecordAt: visibleRecords
        .filter((record) => record.vaultId === vault.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.updatedAt,
    })),
    [vaults, visibleRecords]
  );

  async function handleCreateVault(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = vaultName.trim();

    if (!trimmedName) {
      setMessage("Vault name is required.");
      return;
    }

    const vault = await createVault({
      name: trimmedName,
      description: vaultDescription.trim() || "Encrypted continuity space for sensitive records.",
    });

    setMessage(`Vault "${vault.name}" created and logged securely.`);
    setVaultName("");
    setVaultDescription("");
  }

  return (
    <div className="space-y-8">

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">

        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Digital Vault</Badge>
              <Badge variant="secondary">Metadata only</Badge>
              <Badge variant="secondary">Signed access</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                Secure Continuity Records
              </p>

              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Store continuity records in a calm, controlled vault.
              </h1>

              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                Keep family continuity files organized by category, protect them with encrypted storage, and surface document access only through authorization-checked flows.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard/records/add">
                  <UploadCloud className="h-4 w-4" />
                  Upload record
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard/records/search">
                  <Search className="h-4 w-4" />
                  Search records
                </Link>
              </Button>

              <Button asChild variant="ghost" size="lg">
                <Link href="/dashboard/records/filter">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter records
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Vaults</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{vaults.length}</p>
                <p className="mt-1 text-xs text-slate-400">Owner-only containers</p>
              </div>

              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Records</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{visibleRecords.length}</p>
                <p className="mt-1 text-xs text-slate-400">Metadata with no raw file storage</p>
              </div>

              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Audit entries</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{audits.length}</p>
                <p className="mt-1 text-xs text-slate-400">Sensitive actions logged</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create a vault</CardTitle>
            <CardDescription>
              Add a private continuity container before uploading records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={handleCreateVault}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">
                  Vault name
                </label>
                <Input
                  value={vaultName}
                  onChange={(event) => setVaultName(event.target.value)}
                  placeholder="Primary Continuity Vault"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">
                  Purpose
                </label>
                <Textarea
                  value={vaultDescription}
                  onChange={(event) => setVaultDescription(event.target.value)}
                  placeholder="Encrypted space for family continuity records"
                  rows={4}
                />
              </div>

              <div className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <div className="flex items-center gap-3">
                  <FolderLock className="h-5 w-5 text-[#163B8C]" />
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">
                      Secure container
                    </p>
                    <p className="text-xs text-slate-500">
                      No public URLs. No raw files in the database.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Create vault
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">
                Signed access only
              </p>
              <p className="text-xs text-slate-500">
                Vault creation is logged for audit review.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </CardFooter>
        </Card>
      </section>

      {message ? (
        <Card className="border-[#C7E3D1] bg-[#F2FBF5]">
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{message}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {vaultStats.map((vault) => (
          <Card key={vault.id}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant={vault.status === "Active" ? "success" : "secondary"}>
                    {vault.status}
                  </Badge>
                  <h2 className="text-lg font-semibold text-[#0F172A]">
                    {vault.name}
                  </h2>
                  <p className="text-sm leading-6 text-slate-500">
                    {vault.description}
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#F8FAFC] p-3">
                  <p className="text-xs text-slate-500">Records</p>
                  <p className="mt-1 text-lg font-semibold text-[#0F172A]">{vault.recordCount}</p>
                </div>
                <div className="rounded-2xl bg-[#F8FAFC] p-3">
                  <p className="text-xs text-slate-500">Updated</p>
                  <p className="mt-1 text-sm font-medium text-[#0F172A]">
                    {formatDateOnly(vault.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#EEF2F7] bg-white p-4">
                <p className="text-xs text-slate-500">Policy</p>
                <p className="mt-1 text-sm text-[#0F172A]">{vault.recordPolicy}</p>
              </div>

              <Button asChild variant="outline" className="w-full">
                <Link href={`/dashboard/records/filter?vault=${vault.id}`}>
                  Open vault
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Organize continuity records by the source-approved category structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {categorySummary.map((category) => {
                const Icon = categoryIcons[category.slug];
                return (
                  <Link
                    key={category.slug}
                    href={`/dashboard/records/category/${category.slug}`}
                    className="group rounded-[24px] border border-[#DCE3EC] bg-white p-5 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                          style={{ backgroundColor: `${category.accent}12` }}
                        >
                          <Icon className="h-6 w-6" style={{ color: category.accent }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-[#0F172A]">
                            {category.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {category.description}
                          </p>
                        </div>
                      </div>

                      <ArrowRight className="mt-1 h-5 w-5 text-slate-400 transition group-hover:text-[#163B8C]" />
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Badge variant="default">{category.count} records</Badge>
                      {category.latest ? (
                        <span className="text-xs text-slate-400">
                          Updated {formatDateOnly(category.latest.updatedAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No records yet</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current safeguards</CardTitle>
            <CardDescription>
              Security rules that keep vault access controlled and auditable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Records store metadata only, not raw file contents.",
              "Preview and download actions require server-side authorization checks.",
              "Temporary access links expire quickly and are never public.",
              "All sensitive events are captured in the audit trail.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-[#EEF2F7] p-4"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent records</CardTitle>
            <CardDescription>
              The latest continuity files uploaded to the vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRecords.length ? (
              recentRecords.map((record) => {
                const category = getRecordCategory(record);
                const vaultName = getRecordVaultName(vaults, record);

                return (
                  <Link
                    key={record.id}
                    href={`/dashboard/records/${record.id}`}
                    className="group flex items-center justify-between gap-4 rounded-[24px] border border-[#DCE3EC] bg-white p-4 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF]">
                        <FileText className="h-6 w-6 text-[#163B8C]" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-[#0F172A]">
                          {record.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {category.title} • {vaultName}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDateTime(record.updatedAt)}
                          <span>•</span>
                          {formatBytes(record.fileSize)}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant={record.status === "Verified" ? "success" : "warning"}>
                        {record.status}
                      </Badge>
                      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-[#163B8C]" />
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center">
                <p className="text-base font-medium text-[#0F172A]">No records yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Upload the first continuity file to start organizing the vault.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent audit trail</CardTitle>
            <CardDescription>
              Sensitive vault actions stay visible for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAudits.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[24px] border border-[#DCE3EC] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {entry.action.replace("-", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.subjectTitle}
                    </p>
                  </div>

                  <Badge variant={entry.outcome === "success" ? "success" : "destructive"}>
                    {entry.outcome}
                  </Badge>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {entry.details}
                </p>

                <p className="mt-3 text-xs text-slate-400">
                  {entry.actor} • {formatDateTime(entry.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
