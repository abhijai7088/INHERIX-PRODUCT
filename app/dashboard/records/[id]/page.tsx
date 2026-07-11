"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  FolderLock,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import ShareRecordModal from "@/app/dashboard/records/components/ShareRecordModal";
import {
  formatBytes,
  formatDateOnly,
  formatDateTime,
  getCategoryBySlug,
  getRecordById,
  getVaultById,
  recordCategories,
} from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

export default function RecordDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { vaults, records, audits, updateRecord, viewRecord, archiveRecord, softDeleteRecord } = useRecordsStore();
  const recordId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const record = useMemo(() => getRecordById(records, recordId), [records, recordId]);
  const [editing, setEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const lastViewedRecordId = useRef<string | null>(null);

  const [form, setForm] = useState({
    title: record?.title ?? "",
    description: record?.description ?? "",
    categorySlug: record?.categorySlug ?? recordCategories[0].slug,
    vaultId: record?.vaultId ?? vaults[0]?.id ?? "",
    previewAllowed: record?.previewAllowed ?? true,
    downloadAllowed: record?.downloadAllowed ?? true,
    metadataNotes: record?.metadataNotes ?? "",
    tags: record?.tags.join(", ") ?? "",
  });

  const recordAudits = useMemo(
    () => audits.filter((entry) => entry.subjectId === recordId),
    [audits, recordId]
  );

  useEffect(() => {
    if (!record) {
      return;
    }

    if (lastViewedRecordId.current === record.id) {
      return;
    }

    lastViewedRecordId.current = record.id;
    void viewRecord(record.id);
  }, [record, viewRecord]);

  if (!record) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-sm font-medium text-[#163B8C]">Continuity Records</p>
            <h1 className="text-3xl font-semibold text-[#0F172A]">Record not found</h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-500">
              The selected record is unavailable or has been removed from the current vault state.
            </p>
            <Button asChild>
              <Link href="/dashboard/records">
                <ArrowLeft className="h-4 w-4" />
                Back to records
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const category = getCategoryBySlug(record.categorySlug);
  const vault = getVaultById(vaults, record.vaultId);
  function handleShareModalOpen() {
    setShareModalOpen(true);
    setStatusMessage("Open the access-rule dialog to assign a nominee and release condition.");
  }

  async function handleSave() {
    if (!record) {
      return;
    }

    const result = await updateRecord({
      id: record.id,
      title: form.title,
      description: form.description,
      categorySlug: form.categorySlug as typeof record.categorySlug,
      vaultId: form.vaultId,
      previewAllowed: form.previewAllowed,
      downloadAllowed: form.downloadAllowed,
      metadataNotes: form.metadataNotes,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    if (result.ok) {
      setEditing(false);
    setStatusMessage("Metadata updated and logged for audit review.");
      router.refresh();
    }
  }

  function handleArchive() {
    if (!record) {
      return;
    }

    if (!window.confirm("Archive this record and keep it in the vault history?")) {
      return;
    }

    void archiveRecord(record.id);
    setStatusMessage("Record archived and retained for audit history.");
    router.refresh();
  }

  function handleDelete() {
    if (!record) {
      return;
    }

    if (!window.confirm("Soft delete this record? The audit trail will remain intact.")) {
      return;
    }

    void softDeleteRecord(record.id);
    setStatusMessage("Record soft deleted. Audit history is preserved.");
    router.push("/dashboard/records");
  }

  return (
    <div className="space-y-8">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="icon">
              <Link href="/dashboard/records">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Badge variant="default">{category.title}</Badge>
            <Badge variant={record.status === "Verified" ? "success" : "warning"}>{record.status}</Badge>
            {record.softDeleted ? <Badge variant="destructive">Soft deleted</Badge> : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
              Secure Record Detail
            </p>
            <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[42px]">
              {record.title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-500 lg:text-base">
              Inspect metadata, preview permission state, download control and audit history without exposing raw file storage locations.
            </p>
          </div>
        </div>

        <Card className="w-full max-w-[360px]">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <FolderLock className="h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">
                  Vault
                </p>
                <p className="text-xs text-slate-500">
                  {vault?.name ?? "Unknown vault"}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F8FAFC] p-3">
                <p className="text-xs text-slate-500">Uploaded</p>
                <p className="mt-1 text-sm font-medium text-[#0F172A]">{formatDateOnly(record.uploadedAt)}</p>
              </div>
              <div className="rounded-2xl bg-[#F8FAFC] p-3">
                <p className="text-xs text-slate-500">Updated</p>
                <p className="mt-1 text-sm font-medium text-[#0F172A]">{formatDateOnly(record.updatedAt)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[#EEF2F7] bg-white p-4">
              <p className="text-xs text-slate-500">Access posture</p>
              <p className="mt-1 text-sm text-[#0F172A]">
                {record.previewAllowed ? "Preview available after authorization." : "Preview blocked until release is approved."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {statusMessage ? (
        <Card className="border-[#C7E3D1] bg-[#F2FBF5]">
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{statusMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">

        <Card>
          <CardHeader>
            <CardTitle>Record summary</CardTitle>
            <CardDescription>
              Metadata, file references and security posture for the selected record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: "File name", value: record.fileName },
                { label: "File type", value: record.fileType },
                { label: "File size", value: formatBytes(record.fileSize) },
                { label: "Checksum", value: record.checksum },
                { label: "Encryption ref", value: record.encryptionReference },
                { label: "Storage key", value: "Protected storage reference" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-[#DCE3EC] bg-white p-4"
                >
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-2 break-words text-sm font-medium text-[#0F172A]">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <p className="text-xs text-slate-500">Description</p>
                <p className="mt-2 text-sm leading-6 text-[#0F172A]">{record.description}</p>
              </div>
              <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <p className="text-xs text-slate-500">Metadata notes</p>
                <p className="mt-2 text-sm leading-6 text-[#0F172A]">{record.metadataNotes}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <p className="text-xs text-slate-500">Preview permission</p>
                <Badge variant={record.previewAllowed ? "success" : "secondary"} className="mt-2">
                  {record.previewAllowed ? "Allowed" : "Blocked"}
                </Badge>
              </div>
              <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <p className="text-xs text-slate-500">Download permission</p>
                <Badge variant={record.downloadAllowed ? "success" : "secondary"} className="mt-2">
                  {record.downloadAllowed ? "Allowed" : "Blocked"}
                </Badge>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">Security notice</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This record remains within the owner-scoped vault. Temporary access URLs should be issued only after authorization checks and never shown publicly.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access rules</CardTitle>
            <CardDescription>
              Create controlled sharing rules for this record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleShareModalOpen}>
              <FolderLock className="h-4 w-4" />
              Share record
            </Button>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm font-medium text-[#0F172A]">Access rules</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Access rules define the nominee, scope, and future release condition.</li>
                <li>Rules do not expose the document until trigger verification completes.</li>
                <li>Every rule change is captured in the access-rule audit trail.</li>
              </ul>
            </div>

            <div className="rounded-[24px] border border-[#EEF2F7] bg-white p-4">
              <p className="text-sm font-medium text-[#0F172A]">Upload path</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                File upload remains encrypted and stored outside the database. This screen only manages selective release rules.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Edit metadata</CardTitle>
            <CardDescription>
              Update record details while keeping the audit trail intact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                variant={editing ? "outline" : "primary"}
                onClick={() => {
                  setForm({
                    title: record.title,
                    description: record.description,
                    categorySlug: record.categorySlug,
                    vaultId: record.vaultId,
                    previewAllowed: record.previewAllowed,
                    downloadAllowed: record.downloadAllowed,
                    metadataNotes: record.metadataNotes,
                    tags: record.tags.join(", "),
                  });
                  setEditing((current) => !current);
                }}
              >
                <Pencil className="h-4 w-4" />
                {editing ? "Close editor" : "Edit record"}
              </Button>

              <Button
                variant="outline"
                onClick={handleArchive}
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>

              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>

            {editing ? (
              <div className="space-y-4 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Title</label>
                    <Input
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Vault</label>
                    <select
                      value={form.vaultId}
                      onChange={(event) => setForm((current) => ({ ...current, vaultId: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                    >
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
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Category</label>
                  <select
                    value={form.categorySlug}
                    onChange={(event) => setForm((current) => ({ ...current, categorySlug: event.target.value as typeof current.categorySlug }))}
                    className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                  >
                    {recordCategories.map((category) => (
                      <option
                        key={category.slug}
                        value={category.slug}
                      >
                        {category.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Description</label>
                  <Textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Metadata notes</label>
                  <Textarea
                    value={form.metadataNotes}
                    onChange={(event) => setForm((current) => ({ ...current, metadataNotes: event.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Tags</label>
                  <Input
                    value={form.tags}
                    onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="estate, continuity, secure"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm">
                    Preview allowed
                    <input
                      type="checkbox"
                      checked={form.previewAllowed}
                      onChange={(event) => setForm((current) => ({ ...current, previewAllowed: event.target.checked }))}
                      className="h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm">
                    Download allowed
                    <input
                      type="checkbox"
                      checked={form.downloadAllowed}
                      onChange={(event) => setForm((current) => ({ ...current, downloadAllowed: event.target.checked }))}
                      className="h-5 w-5"
                    />
                  </label>
                </div>

                <Button onClick={handleSave}>
                  <CheckCircle2 className="h-4 w-4" />
                  Save changes
                </Button>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm leading-6 text-slate-500">
                Open the editor to update metadata, permission flags and record notes. Every save is logged in the audit trail.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit history</CardTitle>
            <CardDescription>
              Actions linked to this record are preserved here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recordAudits.length ? (
              recordAudits.map((entry) => (
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
                        {entry.actor}
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
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                No audit events have been recorded for this record yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <ShareRecordModal
        open={shareModalOpen}
        setOpen={setShareModalOpen}
        documentId={record.id}
        documentTitle={record.title}
        onCreated={() => {
          setStatusMessage("Access rule created and audited.");
        }}
      />
    </div>
  );
}
