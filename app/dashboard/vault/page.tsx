"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderLock, Plus, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import { backendJsonFetch } from "@/lib/auth-state";
import { formatBytes, formatDateTime } from "@/lib/records";

type Vault = {
  id: string;
  vaultName: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentCategory = {
  id: string;
  categoryName: string;
  description: string | null;
  isActive: boolean;
};

type DocumentItem = {
  id: string;
  documentTitle: string;
  documentDescription: string | null;
  originalFileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  status: string;
  categoryName: string;
  vaultName: string;
  uploadedAt: string;
  updatedAt: string;
};

function extractError(message: unknown) {
  if (typeof message === "string") {
    return message;
  }

  return "The backend request could not be completed.";
}

export default function VaultPage() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [vaultName, setVaultName] = useState("");
  const [vaultDescription, setVaultDescription] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadVaultData(vaultId?: string | null) {
    setRefreshing(true);
    try {
      const [vaultResponse, categoryResponse, documentResponse] = await Promise.all([
        backendJsonFetch("/vaults"),
        backendJsonFetch("/document-categories"),
        backendJsonFetch(vaultId ? `/documents?vaultId=${encodeURIComponent(vaultId)}` : "/documents"),
      ]);

      const vaultJson = await vaultResponse.json();
      const categoryJson = await categoryResponse.json();
      const documentJson = await documentResponse.json();

      if (!vaultResponse.ok) {
        throw new Error(vaultJson.message ?? "Unable to load vaults.");
      }

      if (!categoryResponse.ok) {
        throw new Error(categoryJson.message ?? "Unable to load categories.");
      }

      if (!documentResponse.ok) {
        throw new Error(documentJson.message ?? "Unable to load documents.");
      }

      const nextVaults = (vaultJson.data?.vaults ?? []) as Vault[];
      const nextCategories = (categoryJson.data?.categories ?? []) as DocumentCategory[];
      const nextDocuments = (documentJson.data?.documents ?? []) as DocumentItem[];

      setVaults(nextVaults);
      setCategories(nextCategories);
      setDocuments(nextDocuments);

      setSelectedVaultId((current) => current || nextVaults[0]?.id || "");
      setSelectedCategoryId((current) => current || nextCategories[0]?.id || "");
    } catch (error) {
      setStatusMessage(extractError(error instanceof Error ? error.message : error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadVaultData();
    }, 0);

    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (selectedVaultId) {
      void (async () => {
        try {
          const response = await backendJsonFetch(`/documents?vaultId=${encodeURIComponent(selectedVaultId)}`);
          const json = await response.json();
          if (!response.ok) {
            throw new Error(json.message ?? "Unable to load vault documents.");
          }

          setDocuments((json.data?.documents ?? []) as DocumentItem[]);
        } catch (error) {
          setStatusMessage(extractError(error instanceof Error ? error.message : error));
        }
      })();
    }
  }, [selectedVaultId]);

  async function handleCreateVault(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);

    const response = await backendJsonFetch("/vaults", {
      method: "POST",
      body: JSON.stringify({
        vaultName,
        description: vaultDescription || null,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      setStatusMessage(extractError(json.message));
      return;
    }

    setVaultName("");
    setVaultDescription("");
    setStatusMessage("Vault created through the backend and stored in PostgreSQL.");
    await loadVaultData(json.data?.vault?.id ?? selectedVaultId);
  }

  async function handleUploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);

    if (!selectedVaultId) {
      setStatusMessage("Choose a vault before uploading a document.");
      return;
    }

    if (!selectedCategoryId) {
      setStatusMessage("Choose a document category before uploading.");
      return;
    }

    if (!file) {
      setStatusMessage("Choose a file to upload.");
      return;
    }

    const uploadResponse = await backendJsonFetch("/documents/upload", {
      method: "POST",
      body: JSON.stringify({
        vaultId: selectedVaultId,
        categoryId: selectedCategoryId,
        documentTitle,
        documentDescription: documentDescription || null,
        originalFileName: file.name,
        fileMimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        fileHash: null,
      }),
    });

    const uploadJson = await uploadResponse.json();
    if (!uploadResponse.ok) {
      setStatusMessage(extractError(uploadJson.message));
      return;
    }

    const upload = uploadJson.data?.upload as { url: string; requiredHeaders?: Record<string, string> } | undefined;
    if (!upload?.url) {
      setStatusMessage("The backend did not return a signed upload URL.");
      return;
    }

    const putHeaders = new Headers(upload.requiredHeaders ?? {});
    const putResponse = await fetch(upload.url, {
      method: "PUT",
      headers: putHeaders,
      body: file,
    });

    if (!putResponse.ok) {
      setStatusMessage("The signed upload failed before the file could be stored in S3.");
      return;
    }

    setDocumentTitle("");
    setDocumentDescription("");
    setFile(null);
    setStatusMessage("Document uploaded to encrypted S3 storage and recorded in PostgreSQL.");
    await loadVaultData(selectedVaultId);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Vault management</Badge>
              <Badge variant="secondary">Encrypted S3</Badge>
              <Badge variant="secondary">Signed URLs only</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                Secure continuity storage
              </p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Manage real vault records, categories, and uploads through the backend.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                This view talks to PostgreSQL and issues time-limited S3 upload tickets. No public file URLs are exposed and every sensitive action is written to the audit trail.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard/records">
                  <ShieldCheck className="h-4 w-4" />
                  Open records
                </Link>
              </Button>
              <Button variant="outline" size="lg" onClick={() => void loadVaultData(selectedVaultId)}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create vault</CardTitle>
            <CardDescription>
              Customers can create a private vault before uploading continuity records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateVault}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Vault name</label>
                <Input value={vaultName} onChange={(event) => setVaultName(event.target.value)} placeholder="Primary Continuity Vault" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Description</label>
                <Textarea
                  value={vaultDescription}
                  onChange={(event) => setVaultDescription(event.target.value)}
                  rows={4}
                  placeholder="Encrypted storage for release-ready records"
                />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Create vault
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {statusMessage ? (
        <Card className="border-[#C7E3D1] bg-[#F2FBF5]">
          <CardContent className="flex items-center gap-3 p-5">
            <FolderLock className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{statusMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Vaults</CardTitle>
            <CardDescription>These vaults are stored in PostgreSQL and scoped to the signed-in customer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading vaults...</p>
            ) : vaults.length ? (
              vaults.map((vault) => (
                <button
                  key={vault.id}
                  type="button"
                  onClick={() => setSelectedVaultId(vault.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    selectedVaultId === vault.id
                      ? "border-[#163B8B] bg-[#F8FBFF]"
                      : "border-[#DCE3EC] bg-white hover:border-[#163B8B] hover:bg-[#F8FBFF]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-[#0F172A]">{vault.vaultName}</p>
                        <Badge variant={vault.status === "ACTIVE" ? "success" : "secondary"}>{vault.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{vault.description ?? "No description provided."}</p>
                      <p className="mt-2 text-xs text-slate-400">Created {formatDateTime(vault.createdAt)}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">No vaults exist yet for this account.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document upload</CardTitle>
            <CardDescription>Choose a vault, category, and file. The backend will return a signed upload ticket.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUploadDocument}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Vault</label>
                <select
                  value={selectedVaultId}
                  onChange={(event) => setSelectedVaultId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none"
                >
                  <option value="">Select a vault</option>
                  {vaults.map((vault) => (
                    <option key={vault.id} value={vault.id}>
                      {vault.vaultName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(event) => setSelectedCategoryId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.categoryName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Document title</label>
                <Input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Will Document" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Description</label>
                <Textarea
                  value={documentDescription}
                  onChange={(event) => setDocumentDescription(event.target.value)}
                  rows={3}
                  placeholder="Encrypted source document ready for controlled continuity release"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">File</label>
                <input
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-[#EEF4FF] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#163B8B]"
                />
              </div>
              <Button type="submit" className="w-full" disabled={refreshing}>
                <UploadCloud className="h-4 w-4" />
                Start secure upload
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Documents in selected vault</CardTitle>
            <CardDescription>
              Only metadata is shown here. The encrypted document object remains in S3 behind a temporary signed URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.length ? (
              documents.map((document) => (
                <div key={document.id} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#0F172A]">{document.documentTitle}</h3>
                        <Badge variant={document.status === "ACTIVE" ? "success" : "secondary"}>{document.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {document.categoryName} • {document.vaultName}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{document.documentDescription ?? "No description provided."}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {document.originalFileName ?? "Encrypted file"} • {document.fileSize ? formatBytes(document.fileSize) : "Unknown size"}
                      </p>
                    </div>
                    <div className="text-xs text-slate-400">
                      <p>Uploaded {formatDateTime(document.uploadedAt)}</p>
                      <p className="mt-1">Updated {formatDateTime(document.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No documents are stored in this vault yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#EEF4FF]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <FolderLock className="h-5 w-5 text-[#163B8B]" />
              <p className="text-sm font-medium text-[#0F172A]">Security posture</p>
            </div>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>No document content is stored in the database.</p>
              <p>All uploads use a temporary signed S3 URL that expires automatically.</p>
              <p>Vault and document mutations are written to audit logs.</p>
              <p>Unreleased files never appear to nominees or public visitors.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
