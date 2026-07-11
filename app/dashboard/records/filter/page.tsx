"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import {
  formatDateTime,
  getRecordCategory,
  getRecordVaultName,
  normalizeFileType,
  recordCategories,
  withinDateRange,
} from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

type DateRange = "all" | "7d" | "30d" | "90d" | "1y";

export default function FilterPage() {
  const { vaults, records } = useRecordsStore();
  const [category, setCategory] = useState<string>("all");
  const [vaultId, setVaultId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [fileType, setFileType] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState(true);

  const visibleRecords = useMemo(
    () =>
      records.filter((record) => {
        if (!includeArchived && record.status === "Archived") {
          return false;
        }

        if (category !== "all" && record.categorySlug !== category) {
          return false;
        }

        if (vaultId !== "all" && record.vaultId !== vaultId) {
          return false;
        }

        if (status !== "all" && record.status !== status) {
          return false;
        }

        if (fileType !== "all" && normalizeFileType(record.fileName) !== fileType) {
          return false;
        }

        if (!withinDateRange(record.updatedAt, dateRange)) {
          return false;
        }

        return !record.softDeleted;
      }),
    [category, dateRange, fileType, includeArchived, records, status, vaultId]
  );

  const activeFilters = [
    category !== "all" ? recordCategories.find((item) => item.slug === category)?.title : null,
    vaultId !== "all" ? vaults.find((item) => item.id === vaultId)?.name : null,
    status !== "all" ? status : null,
    dateRange !== "all" ? dateRange : null,
    fileType !== "all" ? fileType.toUpperCase() : null,
    !includeArchived ? "Hide archived" : null,
  ].filter(Boolean) as string[];

  function resetFilters() {
    setCategory("all");
    setVaultId("all");
    setStatus("all");
    setDateRange("all");
    setFileType("all");
    setIncludeArchived(true);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-8">

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge variant="default">Filter</Badge>
          <Badge variant="secondary">Vault scoped</Badge>
        </div>
        <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[40px]">
          Refine continuity records
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
          Narrow the vault by category, vault, status, date range and file type while keeping every record owner-scoped and auditable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter controls</CardTitle>
          <CardDescription>
            Use the controls below to shape the record list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
              >
                <option value="all">All categories</option>
                {recordCategories.map((item) => (
                  <option
                    key={item.slug}
                    value={item.slug}
                  >
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">Vault</label>
              <select
                value={vaultId}
                onChange={(event) => setVaultId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
              >
                <option value="all">All vaults</option>
                {vaults.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
              >
                <option value="all">All statuses</option>
                <option value="Verified">Verified</option>
                <option value="Pending review">Pending review</option>
                <option value="Restricted">Restricted</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">Date updated</label>
              <select
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value as DateRange)}
                className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
              >
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">File type</label>
              <select
                value={fileType}
                onChange={(event) => setFileType(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
              >
                <option value="all">All types</option>
                <option value="pdf">PDF</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
              </select>
            </div>

            <label className="flex items-center justify-between rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm">
              Include archived
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeFilters.length ? activeFilters.map((item) => (
              <Badge
                key={item}
                variant="default"
              >
                {item}
              </Badge>
            )) : (
              <Badge variant="secondary">No active filters</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
            >
              <RotateCcw className="h-4 w-4" />
              Clear filters
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/records/search">
                <SlidersHorizontal className="h-4 w-4" />
                Search instead
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Filtered records</h2>
          <p className="text-sm text-slate-500">
            {visibleRecords.length} record{visibleRecords.length === 1 ? "" : "s"} matched the current filter set.
          </p>
        </div>
        <Badge variant="secondary">Audit friendly</Badge>
      </div>

      <div className="grid gap-4">
        {visibleRecords.length ? (
          visibleRecords.map((record) => {
            const categoryMeta = getRecordCategory(record);
            const vaultName = getRecordVaultName(vaults, record);

            return (
              <Link
                key={record.id}
                href={`/dashboard/records/${record.id}`}
                className="group rounded-[28px] border border-[#DCE3EC] bg-white p-5 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{categoryMeta.title}</Badge>
                      <Badge variant={record.status === "Verified" ? "success" : "warning"}>
                        {record.status}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-[#0F172A]">{record.title}</h3>
                    <p className="max-w-3xl text-sm leading-6 text-slate-500">
                      {record.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {vaultName} • {formatDateTime(record.updatedAt)}
                    </p>
                  </div>

                  <ArrowRight className="mt-1 h-5 w-5 text-slate-400 transition group-hover:text-[#163B8C]" />
                </div>
              </Link>
            );
          })
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-base font-medium text-[#0F172A]">No filtered records</p>
              <p className="mt-2 text-sm text-slate-500">
                Try loosening the filters or include archived records.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
