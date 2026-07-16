"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CloudUpload,
  FileText,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import {
  RECORD_ALLOWED_EXTENSIONS,
  RECORD_MAX_FILE_SIZE_BYTES,
  formatBytes,
  formatDateOnly,
  getRecordCategorySlugFromBackendCategoryName,
  recordCategories,
  type RecordCategorySlug,
} from "@/lib/records";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

const CATEGORY_TITLE_SUGGESTIONS: Record<RecordCategorySlug, string[]> = {
  "legal-documents": ["Will Document", "Power of Attorney", "Legal Agreement", "Court Order", "Trust Deed", "Partnership Deed"],
  "financial-information": ["Bank Reference Letter", "Insurance Policy", "Investment Portfolio", "Tax Returns", "Loan Agreement", "Fixed Deposit Receipt"],
  "personal-information": ["Aadhaar Card", "Passport Copy", "PAN Card", "Birth Certificate", "Marriage Certificate", "Medical History"],
  "family-assets": ["Property Deed", "Vehicle Registration", "Gold Holdings Record", "Jewellery Inventory", "Family Home Title", "Land Ownership Document"],
  "business-records": ["Business Registration", "GST Certificate", "Partnership Agreement", "Board Resolution", "Shareholder Agreement", "Company PAN"],
};

const CATEGORY_DESCRIPTION_SUGGESTIONS: Record<RecordCategorySlug, Record<string, string[]>> = {
  "legal-documents": {
    "Will Document": [
      "Original signed will document designating estate beneficiaries and asset distribution.",
      "Notarized will specifying inheritance of property, investments, and personal belongings.",
      "Last will and testament drafted and witnessed in presence of legal counsel.",
    ],
    "Power of Attorney": [
      "General power of attorney granting authority to act on behalf of the principal.",
      "Special power of attorney limited to specific financial or legal transactions.",
      "Durable power of attorney remaining effective even if the principal becomes incapacitated.",
    ],
    "Legal Agreement": [
      "Signed legal agreement outlining obligations, rights, and responsibilities of all parties.",
      "Binding contract executed between parties with witness and notary confirmation.",
    ],
    "Court Order": [
      "Official court order issued by a competent authority regarding legal proceedings.",
      "Certified copy of court judgment relevant to family estate or guardianship.",
    ],
    "Trust Deed": [
      "Trust deed establishing a family trust for asset management and continuity.",
      "Registered trust document specifying trustees, beneficiaries, and governing terms.",
    ],
    "Partnership Deed": [
      "Partnership deed outlining profit sharing, roles, and dissolution terms for the business.",
      "Registered partnership agreement signed by all partners and notarized.",
    ],
    DEFAULT: [
      "Important legal document stored for continuity and family reference.",
      "Certified copy of legal instrument relevant to estate planning.",
    ],
  },
  "financial-information": {
    "Bank Reference Letter": [
      "Official bank reference letter confirming account details and relationship with the bank.",
      "Bank letter for credit verification, account confirmation, and financial history.",
    ],
    "Insurance Policy": [
      "Life insurance policy document with policy number, premium details, and nominee information.",
      "Comprehensive health/term insurance policy covering family members under one plan.",
      "Insurance policy with maturity benefits and claim procedure for nominees.",
    ],
    "Investment Portfolio": [
      "Consolidated investment statement covering mutual funds, stocks, and bonds.",
      "Portfolio summary from DEMAT account showing current holdings and market value.",
    ],
    "Tax Returns": [
      "Income tax return (ITR) filed for the financial year with acknowledgment receipt.",
      "Last 3 years of tax return documents for estate and loan purposes.",
    ],
    "Loan Agreement": [
      "Home/personal loan agreement with repayment schedule and outstanding balance details.",
      "Signed loan document from bank specifying collateral, tenure, and interest rate.",
    ],
    DEFAULT: [
      "Financial document securely stored for family continuity and estate access.",
      "Important financial record with account, policy, or investment details.",
    ],
  },
  "personal-information": {
    "Aadhaar Card": [
      "Original Aadhaar card copy with UID number for identity verification purposes.",
      "Masked Aadhaar copy with last 4 digits visible, suitable for KYC submission.",
    ],
    "Passport Copy": [
      "Valid passport copy with photo page and address page scanned for records.",
      "Passport document stored for international travel, visa, and identity purposes.",
    ],
    "PAN Card": [
      "PAN card copy for income tax, investment, and financial transaction identification.",
      "Permanent Account Number card issued by the Income Tax Department of India.",
    ],
    "Birth Certificate": [
      "Official birth certificate issued by municipal corporation, required for legal and school purposes.",
      "Government-issued birth record confirming date, place, and details of birth.",
    ],
    "Marriage Certificate": [
      "Registered marriage certificate issued by the court or municipality.",
      "Marriage registration document confirming legal union for joint asset and nomination purposes.",
    ],
    DEFAULT: [
      "Personal identification document stored securely for family continuity.",
      "Government-issued identity document required for KYC and estate planning.",
    ],
  },
  "family-assets": {
    "Property Deed": [
      "Registered sale deed or title deed of the property with stamp duty endorsement.",
      "Property document showing ownership, survey number, and encumbrance certificate.",
    ],
    "Vehicle Registration": [
      "RC (Registration Certificate) of vehicle with insurance and fitness certificate.",
      "Vehicle ownership document from RTO including chassis and engine number.",
    ],
    "Gold Holdings Record": [
      "Jeweller certificate and gold holdings statement for valuation and estate planning.",
      "Record of gold coins, bars, or ornaments with weight, purity, and purchase details.",
    ],
    DEFAULT: [
      "Family asset document stored for succession planning and estate continuity.",
      "Ownership record for physical or movable asset held in the family name.",
    ],
  },
  "business-records": {
    "Business Registration": [
      "Certificate of incorporation or firm registration from the relevant authority.",
      "Business registration document from ROC/municipal body confirming legal entity status.",
    ],
    "GST Certificate": [
      "GST registration certificate with GSTIN for business compliance and billing purposes.",
      "Goods and Services Tax certificate issued by the tax authority.",
    ],
    "Partnership Agreement": [
      "Registered partnership deed outlining roles, capital contribution, and profit sharing.",
    ],
    DEFAULT: [
      "Business document stored for corporate continuity and succession planning.",
      "Company registration or compliance record for family business estate purposes.",
    ],
  },
};

function parseCategorySlug(value: string | null): RecordCategorySlug | "" {
  const match = recordCategories.find((category) => category.slug === value);
  return match ? match.slug : "";
}

export default function AddRecordClient({
  initialCategorySlug,
}: {
  initialCategorySlug: string | null;
}) {
  const router = useRouter();
  const { vaults, documentCategories, createVault, uploadRecord } = useRecordsStore();
  const defaultCategory = useMemo(() => parseCategorySlug(initialCategorySlug), [initialCategorySlug]);
  const categoryIdBySlug = useMemo(() => {
    const mapping: Partial<Record<RecordCategorySlug, string>> = {};

    for (const category of documentCategories) {
      const slug = getRecordCategorySlugFromBackendCategoryName(category.categoryName);
      if (slug && !mapping[slug]) {
        mapping[slug] = category.id;
      }
    }

    return mapping;
  }, [documentCategories]);

  const [vaultId, setVaultId] = useState(vaults[0]?.id ?? "");
  const [categorySlug, setCategorySlug] = useState<RecordCategorySlug | "">(defaultCategory);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metadataNotes, setMetadataNotes] = useState("Encrypted file stored as metadata only.");
  const [tagValue, setTagValue] = useState("continuity, secure");
  const [previewAllowed, setPreviewAllowed] = useState(true);
  const [downloadAllowed, setDownloadAllowed] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<"idle" | "validating" | "requesting-upload" | "uploading" | "finalizing">("idle");
  const [creatingVault, setCreatingVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultDescription, setNewVaultDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = recordCategories.find((category) => category.slug === categorySlug);

  useEffect(() => {
    if (!vaultId && vaults[0]?.id) {
      setVaultId(vaults[0].id);
    }
  }, [vaultId, vaults]);

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setFileError(null);

    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowedExtension = RECORD_ALLOWED_EXTENSIONS.includes(extension as (typeof RECORD_ALLOWED_EXTENSIONS)[number]);

    if (!allowedExtension && !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setFileError("Only PDF, JPG and PNG files are allowed.");
      return;
    }

    if (file.size > RECORD_MAX_FILE_SIZE_BYTES) {
      setFileError("Files must be 10 MB or smaller.");
    }
  }

  async function handleCreateVault() {
    const name = newVaultName.trim();

    if (!name) {
      setError("Enter a vault name before creating it.");
      return;
    }

    const vault = await createVault({
      name,
      description: newVaultDescription.trim() || "Encrypted continuity vault created from the upload flow.",
    });

    setVaultId(vault.id);
    setNewVaultName("");
    setNewVaultDescription("");
    setCreatingVault(false);
    setError(null);
  }

  async function submitRecord() {
    setError(null);
    setStatusMessage(null);
    setUploadStage("validating");
    setSubmitting(true);

    try {
      if (!vaultId) {
        setError("Choose a vault.");
        setUploadStage("idle");
        return;
      }

      if (!categorySlug) {
        setError("Select a category.");
        setUploadStage("idle");
        return;
      }

      if (!categoryIdBySlug[categorySlug]) {
        setError("Document categories are still loading. Please try again in a moment.");
        setUploadStage("idle");
        return;
      }

      if (!selectedFile) {
        setError("Choose a document to upload.");
        setUploadStage("idle");
        return;
      }

      if (fileError) {
        setError(fileError);
        setUploadStage("idle");
        return;
      }

      const result = await uploadRecord({
        title,
        description,
        categorySlug: categorySlug || "legal-documents",
        categoryId: categoryIdBySlug[categorySlug] ?? null,
        vaultId,
        fileName: selectedFile.name,
        fileType: selectedFile.type || "application/octet-stream",
        fileSize: selectedFile.size,
        previewAllowed,
        downloadAllowed,
        metadataNotes,
        tags: tagValue
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        file: selectedFile,
        onStage: (stage) => {
          setUploadStage(stage);
          if (stage === "validating") setStatusMessage("Validating record details...");
          if (stage === "requesting-upload") setStatusMessage("Requesting secure upload credentials...");
          if (stage === "uploading") setStatusMessage("Uploading file to encrypted storage...");
          if (stage === "finalizing") setStatusMessage("Finalizing and refreshing the record ledger...");
        },
      });

      if (!result.ok) {
        setError(result.error);
        setUploadStage("idle");
        return;
      }

      setStatusMessage(`Record saved successfully: ${result.record.title}`);
      setUploadStage("idle");
      router.push(`/dashboard/records/${result.record.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save record.");
      setUploadStage("idle");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitRecord();
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href="/dashboard/records">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Badge variant="default">Secure upload</Badge>
            <Badge variant="secondary">Audit logged</Badge>
          </div>
          <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[40px]">
            Add a continuity record
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
            Upload a protected continuity document into an encrypted vault and keep the database limited to metadata only.
          </p>
        </div>

        <Card className="w-full max-w-[360px]">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Allowed files</p>
                <p className="text-xs text-slate-500">PDF, JPG and PNG up to 10 MB.</p>
              </div>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] p-3 text-xs text-slate-500">
              Records never store raw files in the database.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload details</CardTitle>
            <CardDescription>
              Select a vault, choose a category, and attach the secure file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Vault</label>
                  <select
                    value={vaultId}
                    onChange={(event) => setVaultId(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                  >
                    {vaults.map((vault) => (
                      <option
                        key={vault.id}
                        value={vault.id}
                      >
                        {vault.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Category</label>
                  <select
                    value={categorySlug}
                    onChange={(event) => setCategorySlug(event.target.value as RecordCategorySlug)}
                    className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                  >
                    <option value="">Select category</option>
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
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Title</label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={categorySlug && CATEGORY_TITLE_SUGGESTIONS[categorySlug]?.[0] ? CATEGORY_TITLE_SUGGESTIONS[categorySlug][0] : "Document title"}
                />
                {categorySlug && CATEGORY_TITLE_SUGGESTIONS[categorySlug]?.length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CATEGORY_TITLE_SUGGESTIONS[categorySlug].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setTitle(suggestion)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          title === suggestion
                            ? "border-[#163B8C] bg-[#163B8C] text-white"
                            : "border-[#DCE3EC] bg-[#F8FAFC] text-slate-600 hover:border-[#163B8C] hover:bg-[#EEF4FF] hover:text-[#163B8C]"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">Description</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Summarize what the record contains and why it matters."
                  rows={4}
                />
                {(() => {
                  if (!categorySlug) return null;
                  const catSuggestions = CATEGORY_DESCRIPTION_SUGGESTIONS[categorySlug];
                  if (!catSuggestions) return null;
                  const suggestions = (title && catSuggestions[title]) ? catSuggestions[title] : catSuggestions["DEFAULT"] ?? [];
                  if (!suggestions.length) return null;
                  return (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-medium text-slate-400">Quick suggestions — click to use:</p>
                      <div className="flex flex-col gap-1.5">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setDescription(suggestion)}
                            className={`rounded-2xl border px-3 py-2 text-xs text-left font-medium transition-all ${
                              description === suggestion
                                ? "border-[#163B8C] bg-[#163B8C] text-white"
                                : "border-[#DCE3EC] bg-[#F8FAFC] text-slate-600 hover:border-[#163B8C] hover:bg-[#EEF4FF] hover:text-[#163B8C]"
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-[28px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF]">
                    <CloudUpload className="h-5 w-5 text-[#163B8C]" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#0F172A]">Attach file</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Choose a secure document from your device.
                      </p>
                    </div>

                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-[#163B8C] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                    />

                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Maximum size: {formatBytes(RECORD_MAX_FILE_SIZE_BYTES)}</span>
                      <span>•</span>
                      <span>Supported: PDF, JPG, PNG</span>
                    </div>

                    {selectedFile ? (
                      <div className="rounded-2xl border border-[#DCE3EC] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[#0F172A]">
                              {selectedFile.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatBytes(selectedFile.size)} • {selectedFile.type || "unknown type"}
                            </p>
                          </div>
                          <FileText className="h-5 w-5 text-[#163B8C]" />
                        </div>
                      </div>
                    ) : null}

                    {fileError ? <p className="text-sm text-red-600">{fileError}</p> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Metadata notes</label>
                  <Textarea
                    value={metadataNotes}
                    onChange={(event) => setMetadataNotes(event.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Tags</label>
                    <Input
                      value={tagValue}
                      onChange={(event) => setTagValue(event.target.value)}
                      placeholder="continuity, secure"
                    />
                  </div>

                  <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Secure preview</p>
                        <p className="text-xs text-slate-500">
                          Generate a temporary access token after authorization checks.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={previewAllowed}
                        onChange={(event) => setPreviewAllowed(event.target.checked)}
                        className="h-5 w-5"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Secure download</p>
                        <p className="text-xs text-slate-500">
                          Permit download only when the record is authorized.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={downloadAllowed}
                        onChange={(event) => setDownloadAllowed(event.target.checked)}
                        className="h-5 w-5"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="rounded-2xl border border-[#D8E6FF] bg-[#F5F8FF] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#0F172A]">Upload status</p>
                    <p className="text-sm text-[#12306D]">
                      {statusMessage ?? "Ready to save this record."}
                    </p>
                  </div>
                  <Badge variant={error ? "destructive" : submitting ? "warning" : "success"}>
                    {submitting ? "Working" : error ? "Needs attention" : "Ready"}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-[#12306D] sm:grid-cols-2">
                  <p>Stage: {uploadStage}</p>
                  <p>{selectedFile ? `File: ${selectedFile.name}` : "No file selected"}</p>
                  <p>
                    Category ID: {categorySlug ? categoryIdBySlug[categorySlug] ?? "Loading mapping..." : "No category selected"}
                  </p>
                </div>

                {error?.toLowerCase().includes("storage") ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" onClick={() => void submitRecord()} disabled={submitting}>
                      Retry upload
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setUploadStage("idle")} disabled={submitting}>
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save record"}
                </Button>
                <Button
                  asChild
                  variant="outline"
                >
                  <Link href="/dashboard/records">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vault status</CardTitle>
              <CardDescription>
                Upload only into an owned vault with explicit metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {vaults.length ? (
                vaults.map((vault) => (
                  <div
                    key={vault.id}
                    className="rounded-[24px] border border-[#DCE3EC] bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {vault.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Created {formatDateOnly(vault.createdAt)}
                        </p>
                      </div>
                      <Badge variant="success">{vault.status}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
                  <p className="text-sm font-medium text-[#0F172A]">
                    No vault exists yet.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Create a vault first so the upload can stay owner-scoped.
                  </p>
                </div>
              )}

              <div className="rounded-[24px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                  <p className="text-sm leading-6 text-slate-600">
                    The upload flow keeps raw files out of the database, encrypts storage, and creates an audit log entry for the action.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create a new vault</CardTitle>
              <CardDescription>
                If needed, create a fresh vault before uploading the document.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {creatingVault ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Vault name</label>
                    <Input
                      value={newVaultName}
                      onChange={(event) => setNewVaultName(event.target.value)}
                      placeholder="Family Continuity Vault"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Purpose</label>
                    <Textarea
                      value={newVaultDescription}
                      onChange={(event) => setNewVaultDescription(event.target.value)}
                      placeholder="Encrypted storage for important continuity records."
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" onClick={handleCreateVault}>Create vault</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreatingVault(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  variant="outline"
                  onClick={() => setCreatingVault(true)}
                >
                  <Plus className="h-4 w-4" />
                  Start a new vault
                </Button>
              )}
            </CardContent>
          </Card>

          {selectedCategory ? (
            <Card>
              <CardHeader>
                <CardTitle>Selected category</CardTitle>
                <CardDescription>{selectedCategory.title}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  {selectedCategory.description}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <Link href={`/dashboard/records/category/${selectedCategory.slug}`}>
                    View category records
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
