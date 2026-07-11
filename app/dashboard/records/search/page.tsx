"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  FileText,
  Search,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { formatBytes, formatDateTime, getRecordCategory, getRecordVaultName, matchesSearch } from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

export default function SearchPage() {
  const { vaults, records } = useRecordsStore();
  const [query, setQuery] = useState("");

  const visibleRecords = useMemo(
    () => records.filter((record) => !record.softDeleted),
    [records]
  );

  const results = useMemo(
    () =>
      visibleRecords.filter((record) =>
        matchesSearch(
          record,
          query,
          getRecordVaultName(vaults, record),
          getRecordCategory(record).title
        )
      ),
    [query, vaults, visibleRecords]
  );

  const recentSearches = ["Will", "Insurance", "Bank", "Property"];

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-8">

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge variant="default">Search</Badge>
          <Badge variant="secondary">Metadata aware</Badge>
        </div>
        <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[40px]">
          Search continuity records
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
          Search by title, category, vault, file name, status, tags or encrypted reference without exposing the raw storage path.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bank reference, will document, policy, vault name..."
                className="pl-12"
              />
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard/records/filter">
                Go to filters
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentSearches.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuery(item)}
                className="rounded-full border border-[#DCE3EC] bg-white px-4 py-2 text-sm text-[#0F172A] transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
              >
                {item}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Results</h2>
          <p className="text-sm text-slate-500">
            {results.length} record{results.length === 1 ? "" : "s"} matched your query.
          </p>
        </div>
        <Badge variant="secondary">Secure search only</Badge>
      </div>

      <div className="grid gap-4">
        {results.length ? (
          results.map((record) => {
            const category = getRecordCategory(record);
            const vaultName = getRecordVaultName(vaults, record);

            return (
              <Link
                key={record.id}
                href={`/dashboard/records/${record.id}`}
                className="group rounded-[28px] border border-[#DCE3EC] bg-white p-5 transition hover:border-[#163B8C] hover:bg-[#F8FBFF]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF]">
                      <FileText className="h-6 w-6 text-[#163B8C]" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-[#0F172A]">
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

                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={record.status === "Verified" ? "success" : "warning"}>
                      {record.status}
                    </Badge>
                    <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-[#163B8C]" />
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-base font-medium text-[#0F172A]">No matches found</p>
              <p className="mt-2 text-sm text-slate-500">
                Try a different title, category, vault or metadata term.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
