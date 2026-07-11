"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowRight,
  FileText,
  Landmark,
  Briefcase,
  HeartHandshake,
  ShieldCheck,
  Clock3,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { formatBytes, formatDateTime, getCategoryBySlug, getRecordVaultName } from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

const categoryIcons = {
  "financial-information": Landmark,
  "legal-documents": ShieldCheck,
  "personal-information": FileText,
  "family-assets": HeartHandshake,
  "business-records": Briefcase,
};

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const { vaults, records } = useRecordsStore();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "financial-information";
  const category = getCategoryBySlug(slug);

  const categoryRecords = useMemo(
    () =>
      records
        .filter((record) => !record.softDeleted && record.categorySlug === slug)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [records, slug]
  );

  const Icon = categoryIcons[category.slug];

  return (
    <div className="space-y-8">

      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Category</Badge>
            <Badge variant="secondary">{categoryRecords.length} records</Badge>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-3xl"
                  style={{ backgroundColor: `${category.accent}12` }}
                >
                  <Icon
                    className="h-7 w-7"
                    style={{ color: category.accent }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                    Continuity Records
                  </p>
                  <h1 className="mt-1 text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[42px]">
                    {category.title}
                  </h1>
                </div>
              </div>

              <p className="text-sm leading-7 text-slate-500 lg:text-base">
                {category.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard/records/add">
                  <FileText className="h-4 w-4" />
                  Upload record
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/records/filter">
                  Filter records
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Records in category</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {categoryRecords.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Vault coverage</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {new Set(categoryRecords.map((record) => record.vaultId)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Latest update</p>
            <p className="mt-2 text-sm font-medium text-[#0F172A]">
              {categoryRecords[0] ? formatDateTime(categoryRecords[0].updatedAt) : "No records yet"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        {categoryRecords.length ? (
          categoryRecords.map((record) => {
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
                      <h3 className="text-lg font-semibold text-[#0F172A]">{record.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {record.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(record.updatedAt)}
                        <span>•</span>
                        {vaultName}
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
              <p className="text-base font-medium text-[#0F172A]">No records in this category</p>
              <p className="mt-2 text-sm text-slate-500">
                Upload a document to start filling this category.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
