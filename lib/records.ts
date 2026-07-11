export const RECORD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const RECORD_ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;

export const RECORD_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type RecordCategorySlug =
  | "financial-information"
  | "legal-documents"
  | "personal-information"
  | "family-assets"
  | "business-records";

export type RecordStatus = "Verified" | "Pending review" | "Restricted" | "Archived";

export type RecordAction = "view" | "preview" | "download" | "upload" | "edit" | "archive" | "delete" | "vault-create";

export type Vault = {
  id: string;
  name: string;
  description: string;
  status: "Active" | "Locked" | "Needs review";
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  recordPolicy: string;
};

export type RecordCategory = {
  slug: RecordCategorySlug;
  title: string;
  description: string;
  accent: string;
};

export type ContinuityRecord = {
  id: string;
  title: string;
  description: string;
  categorySlug: RecordCategorySlug;
  vaultId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  encryptionReference: string;
  checksum: string;
  status: RecordStatus;
  previewAllowed: boolean;
  downloadAllowed: boolean;
  softDeleted: boolean;
  uploadedAt: string;
  updatedAt: string;
  metadataNotes: string;
  tags: string[];
};

export type AuditEntry = {
  id: string;
  action: string;
  subjectId: string;
  subjectTitle: string;
  vaultId: string;
  actor: string;
  outcome: "success" | "denied";
  details: string;
  createdAt: string;
};

export type AccessTicket = {
  recordId: string;
  action: "preview" | "download";
  token: string;
  expiresAt: string;
};

export type NomineeStatus = "INVITED" | "ACTIVE" | "REJECTED" | "REMOVED" | "PENDING_VERIFICATION";

export type InvitationStatus = "PENDING" | "SENT" | "ACCEPTED" | "REJECTED" | "REMOVED";

export type RelationshipOption =
  | "spouse"
  | "son"
  | "daughter"
  | "brother"
  | "sister"
  | "parent"
  | "trusted-contact"
  | "advisor"
  | "other";

export type Nominee = {
  id: string;
  customerId: string;
  fullName: string;
  email: string;
  mobile: string;
  relationship: RelationshipOption;
  customRelationship?: string;
  status: NomineeStatus;
  invitationStatus: InvitationStatus;
  invitedAt: string;
  acceptedAt?: string | null;
  removedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedRecordIds: string[];
  assignedCategorySlugs: RecordCategorySlug[];
  notes: string;
};

export type AccessRule = {
  id: string;
  customerId: string;
  nomineeId: string;
  documentId?: string | null;
  categorySlug?: RecordCategorySlug | null;
  canView: boolean;
  canDownload: boolean;
  accessCondition: string;
  status: "Active" | "Pending" | "Revoked";
  createdAt: string;
  updatedAt: string;
};

export type CreateVaultInput = {
  name: string;
  description: string;
};

export type UpdateRecordInput = {
  id: string;
  title: string;
  description: string;
  categorySlug: RecordCategorySlug;
  vaultId: string;
  previewAllowed: boolean;
  downloadAllowed: boolean;
  metadataNotes: string;
  tags: string[];
};

export type UploadRecordInput = {
  title: string;
  description: string;
  categorySlug: RecordCategorySlug;
  vaultId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewAllowed: boolean;
  downloadAllowed: boolean;
  metadataNotes: string;
  tags: string[];
};

export const recordCategories: RecordCategory[] = [
  {
    slug: "financial-information",
    title: "Financial Information",
    description: "Banking, savings, investments and wealth references.",
    accent: "#163B8C",
  },
  {
    slug: "legal-documents",
    title: "Legal Documents",
    description: "Wills, agreements, certificates and legal instructions.",
    accent: "#1D4ED8",
  },
  {
    slug: "personal-information",
    title: "Personal Information",
    description: "Identity records, profile details and key references.",
    accent: "#2C5CC5",
  },
  {
    slug: "family-assets",
    title: "Family & Assets",
    description: "Homes, family holdings, beneficiaries and shared assets.",
    accent: "#2456B3",
  },
  {
    slug: "business-records",
    title: "Business Records",
    description: "Operational references, ownership notes and business files.",
    accent: "#0F4AA6",
  },
];

const backendCategoryAliases: Record<RecordCategorySlug, string[]> = {
  "financial-information": ["Bank Documents", "Insurance Documents"],
  "legal-documents": ["Legal Documents"],
  "personal-information": ["Identity Documents", "Medical Documents"],
  "family-assets": ["Property Documents"],
  "business-records": ["Business Documents"],
};

function normalizeCategoryLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function getBackendCategoryNamesForSlug(slug: RecordCategorySlug) {
  return backendCategoryAliases[slug] ?? [];
}

export function getRecordCategorySlugFromBackendCategoryName(categoryName: string): RecordCategorySlug | null {
  const normalizedName = normalizeCategoryLabel(categoryName);

  for (const category of recordCategories) {
    if (normalizeCategoryLabel(category.title) === normalizedName) {
      return category.slug;
    }
  }

  for (const [slug, aliases] of Object.entries(backendCategoryAliases) as Array<[RecordCategorySlug, string[]]>) {
    if (aliases.some((alias) => normalizeCategoryLabel(alias) === normalizedName)) {
      return slug;
    }
  }

  return null;
}

export const defaultVaults: Vault[] = [
  {
    id: "vault-primary",
    name: "Primary Continuity Vault",
    description: "Customer-owned continuity records, secure notes and release-ready metadata.",
    status: "Active",
    ownerName: "Rahul Sharma",
    createdAt: "2026-01-18T09:15:00.000Z",
    updatedAt: "2026-06-08T14:10:00.000Z",
    recordPolicy: "Encrypted storage with signed access only",
  },
];

export const defaultRecords: ContinuityRecord[] = [
  {
    id: "record-will",
    title: "Will Document",
    description: "Latest executed will and beneficiary instructions for the family continuity plan.",
    categorySlug: "legal-documents",
    vaultId: "vault-primary",
    fileName: "Will-Document.pdf",
    fileType: "application/pdf",
    fileSize: 1_248_000,
    storageKey: "vault-primary/legal-documents/record-will.enc",
    encryptionReference: "enc-ref-8b2c-41f0",
    checksum: "sha256:8a0f4f2f5d7e",
    status: "Verified",
    previewAllowed: true,
    downloadAllowed: true,
    softDeleted: false,
    uploadedAt: "2026-05-22T08:30:00.000Z",
    updatedAt: "2026-05-29T11:45:00.000Z",
    metadataNotes: "Stored for controlled release and audit review.",
    tags: ["estate", "beneficiaries", "release-ready"],
  },
  {
    id: "record-bank",
    title: "Bank Reference Letter",
    description: "Primary savings account reference and branch contact details.",
    categorySlug: "financial-information",
    vaultId: "vault-primary",
    fileName: "Bank-Reference.jpg",
    fileType: "image/jpeg",
    fileSize: 892_000,
    storageKey: "vault-primary/financial-information/record-bank.enc",
    encryptionReference: "enc-ref-2f8a-55aa",
    checksum: "sha256:5c1e9fcd04b2",
    status: "Verified",
    previewAllowed: true,
    downloadAllowed: false,
    softDeleted: false,
    uploadedAt: "2026-05-27T13:10:00.000Z",
    updatedAt: "2026-06-01T10:20:00.000Z",
    metadataNotes: "Preview permitted; download requires release approval.",
    tags: ["bank", "reference", "savings"],
  },
  {
    id: "record-policy",
    title: "Insurance Policy",
    description: "Active policy summary, nominee details and policy support contact.",
    categorySlug: "financial-information",
    vaultId: "vault-primary",
    fileName: "Insurance-Policy.pdf",
    fileType: "application/pdf",
    fileSize: 2_014_000,
    storageKey: "vault-primary/financial-information/record-policy.enc",
    encryptionReference: "enc-ref-1a84-2d10",
    checksum: "sha256:c71c2dcb10f4",
    status: "Pending review",
    previewAllowed: true,
    downloadAllowed: true,
    softDeleted: false,
    uploadedAt: "2026-05-30T07:45:00.000Z",
    updatedAt: "2026-06-05T16:25:00.000Z",
    metadataNotes: "Awaiting final verification against the latest policy packet.",
    tags: ["insurance", "nominee", "coverage"],
  },
  {
    id: "record-property",
    title: "Property Deed",
    description: "Residential title deed and property identifier for continuity records.",
    categorySlug: "family-assets",
    vaultId: "vault-primary",
    fileName: "Property-Deed.pdf",
    fileType: "application/pdf",
    fileSize: 1_832_000,
    storageKey: "vault-primary/family-assets/record-property.enc",
    encryptionReference: "enc-ref-5bd1-0f71",
    checksum: "sha256:47a4b8f0da31",
    status: "Verified",
    previewAllowed: true,
    downloadAllowed: true,
    softDeleted: false,
    uploadedAt: "2026-04-28T15:05:00.000Z",
    updatedAt: "2026-05-31T09:40:00.000Z",
    metadataNotes: "Includes ownership note and secure filing reference.",
    tags: ["property", "ownership", "assets"],
  },
  {
    id: "record-business",
    title: "Business Continuity Note",
    description: "Operating account reference and executive contact note for continuity handover.",
    categorySlug: "business-records",
    vaultId: "vault-primary",
    fileName: "Business-Continuity-Note.png",
    fileType: "image/png",
    fileSize: 1_104_000,
    storageKey: "vault-primary/business-records/record-business.enc",
    encryptionReference: "enc-ref-6fbe-92c2",
    checksum: "sha256:3b2d9ce2af4a",
    status: "Restricted",
    previewAllowed: true,
    downloadAllowed: false,
    softDeleted: false,
    uploadedAt: "2026-05-18T11:00:00.000Z",
    updatedAt: "2026-06-02T12:15:00.000Z",
    metadataNotes: "Preview only until release conditions are met.",
    tags: ["business", "operations", "handover"],
  },
  {
    id: "record-id",
    title: "Identity Profile",
    description: "Identity document bundle used for continuity verification.",
    categorySlug: "personal-information",
    vaultId: "vault-primary",
    fileName: "Identity-Profile.pdf",
    fileType: "application/pdf",
    fileSize: 1_016_000,
    storageKey: "vault-primary/personal-information/record-id.enc",
    encryptionReference: "enc-ref-0edc-71ab",
    checksum: "sha256:01d3f5c8a71f",
    status: "Verified",
    previewAllowed: true,
    downloadAllowed: true,
    softDeleted: false,
    uploadedAt: "2026-05-14T10:00:00.000Z",
    updatedAt: "2026-05-20T10:10:00.000Z",
    metadataNotes: "Identity bundle used by support and continuity checks.",
    tags: ["identity", "profile", "verification"],
  },
];

export const defaultAudits: AuditEntry[] = [
  {
    id: "audit-vault",
    action: "vault-create",
    subjectId: "vault-primary",
    subjectTitle: "Primary Continuity Vault",
    vaultId: "vault-primary",
    actor: "Rahul Sharma",
    outcome: "success",
    details: "Vault created and secured for continuity record storage.",
    createdAt: "2026-01-18T09:15:00.000Z",
  },
  {
    id: "audit-upload-1",
    action: "upload",
    subjectId: "record-will",
    subjectTitle: "Will Document",
    vaultId: "vault-primary",
    actor: "Rahul Sharma",
    outcome: "success",
    details: "Encrypted file uploaded with metadata and release status.",
    createdAt: "2026-05-22T08:30:00.000Z",
  },
  {
    id: "audit-upload-2",
    action: "upload",
    subjectId: "record-bank",
    subjectTitle: "Bank Reference Letter",
    vaultId: "vault-primary",
    actor: "Rahul Sharma",
    outcome: "success",
    details: "File stored as metadata only with no public document URL.",
    createdAt: "2026-05-27T13:10:00.000Z",
  },
  {
    id: "audit-view-1",
    action: "view",
    subjectId: "record-policy",
    subjectTitle: "Insurance Policy",
    vaultId: "vault-primary",
    actor: "Rahul Sharma",
    outcome: "success",
    details: "Record viewed from the protected vault detail page.",
    createdAt: "2026-06-05T16:28:00.000Z",
  },
];

export const relationshipOptions: Array<{
  label: string;
  value: RelationshipOption;
}> = [
  { label: "Spouse", value: "spouse" },
  { label: "Son", value: "son" },
  { label: "Daughter", value: "daughter" },
  { label: "Brother", value: "brother" },
  { label: "Sister", value: "sister" },
  { label: "Parent", value: "parent" },
  { label: "Trusted contact", value: "trusted-contact" },
  { label: "Advisor", value: "advisor" },
  { label: "Other", value: "other" },
];

export const defaultNominees: Nominee[] = [
  {
    id: "nominee-rahul",
    customerId: "customer-rahul",
    fullName: "Rahul Sharma",
    email: "rahul@example.com",
    mobile: "+91 9876543210",
    relationship: "spouse",
    status: "ACTIVE",
    invitationStatus: "ACCEPTED",
    invitedAt: "2026-05-10T09:00:00.000Z",
    acceptedAt: "2026-05-12T11:15:00.000Z",
    removedAt: null,
    createdAt: "2026-05-10T09:00:00.000Z",
    updatedAt: "2026-06-01T09:45:00.000Z",
    assignedRecordIds: ["record-will", "record-policy"],
    assignedCategorySlugs: ["legal-documents", "financial-information"],
    notes: "Primary household nominee with restricted record access.",
  },
  {
    id: "nominee-amit",
    customerId: "customer-rahul",
    fullName: "Amit Tyagi",
    email: "amit@example.com",
    mobile: "+91 9999999999",
    relationship: "brother",
    status: "PENDING_VERIFICATION",
    invitationStatus: "SENT",
    invitedAt: "2026-05-28T13:15:00.000Z",
    acceptedAt: null,
    removedAt: null,
    createdAt: "2026-05-28T13:15:00.000Z",
    updatedAt: "2026-06-04T08:30:00.000Z",
    assignedRecordIds: ["record-bank"],
    assignedCategorySlugs: ["financial-information"],
    notes: "Waiting on relationship and identity review.",
  },
  {
    id: "nominee-neha",
    customerId: "customer-rahul",
    fullName: "Neha Sharma",
    email: "neha@example.com",
    mobile: "+91 9666666666",
    relationship: "daughter",
    status: "INVITED",
    invitationStatus: "PENDING",
    invitedAt: "2026-06-02T10:00:00.000Z",
    acceptedAt: null,
    removedAt: null,
    createdAt: "2026-06-02T10:00:00.000Z",
    updatedAt: "2026-06-02T10:00:00.000Z",
    assignedRecordIds: [],
    assignedCategorySlugs: ["personal-information"],
    notes: "Invite prepared with limited visibility until accepted.",
  },
];

export const defaultAccessRules: AccessRule[] = [
  {
    id: "rule-legal-rahul",
    customerId: "customer-rahul",
    nomineeId: "nominee-rahul",
    documentId: "record-will",
    categorySlug: "legal-documents",
    canView: true,
    canDownload: true,
    accessCondition: "Available after release approval.",
    status: "Active",
    createdAt: "2026-05-12T11:20:00.000Z",
    updatedAt: "2026-06-01T09:40:00.000Z",
  },
  {
    id: "rule-financial-amit",
    customerId: "customer-rahul",
    nomineeId: "nominee-amit",
    documentId: null,
    categorySlug: "financial-information",
    canView: true,
    canDownload: false,
    accessCondition: "View only until verification is completed.",
    status: "Pending",
    createdAt: "2026-05-28T13:20:00.000Z",
    updatedAt: "2026-06-04T08:35:00.000Z",
  },
  {
    id: "rule-personal-neha",
    customerId: "customer-rahul",
    nomineeId: "nominee-neha",
    documentId: null,
    categorySlug: "personal-information",
    canView: false,
    canDownload: false,
    accessCondition: "No access until invitation is accepted and status changes to active.",
    status: "Pending",
    createdAt: "2026-06-02T10:05:00.000Z",
    updatedAt: "2026-06-02T10:05:00.000Z",
  },
];

export function getCategoryBySlug(slug: string) {
  return recordCategories.find((category) => category.slug === slug) ?? recordCategories[0];
}

export function getVaultById(vaults: Vault[], id: string) {
  return vaults.find((vault) => vault.id === id);
}

export function getRecordById(records: ContinuityRecord[], id: string) {
  return records.find((record) => record.id === id);
}

export function getRecordCategory(record: ContinuityRecord) {
  return getCategoryBySlug(record.categorySlug);
}

export function getVaultRecordCount(vaults: Vault[], records: ContinuityRecord[], vaultId: string) {
  void vaults;
  return records.filter((record) => record.vaultId === vaultId && !record.softDeleted).length;
}

export function getRecordVaultName(vaults: Vault[], record: ContinuityRecord) {
  return getVaultById(vaults, record.vaultId)?.name ?? "Unknown vault";
}

export function getNomineeById(nominees: Nominee[], id: string) {
  return nominees.find((nominee) => nominee.id === id);
}

export function getNomineeStatusTone(status: NomineeStatus) {
  if (status === "ACTIVE") {
    return "success" as const;
  }

  if (status === "INVITED" || status === "PENDING_VERIFICATION") {
    return "warning" as const;
  }

  if (status === "REJECTED") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function getInvitationTone(status: InvitationStatus) {
  if (status === "ACCEPTED") {
    return "success" as const;
  }

  if (status === "PENDING" || status === "SENT") {
    return "warning" as const;
  }

  if (status === "REJECTED") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function formatRelationship(relationship: RelationshipOption, customRelationship?: string) {
  if (relationship === "other" && customRelationship?.trim()) {
    return customRelationship.trim();
  }

  return relationshipOptions.find((item) => item.value === relationship)?.label ?? "Other";
}

export function countAssignedDocuments(nominee: Nominee, accessRules: AccessRule[]) {
  const documentIds = new Set(
    accessRules
      .filter((rule) => rule.nomineeId === nominee.id && rule.documentId)
      .map((rule) => rule.documentId)
      .filter(Boolean) as string[]
  );

  return nominee.assignedRecordIds.length || documentIds.size;
}

export function countNomineeRules(nomineeId: string, accessRules: AccessRule[]) {
  return accessRules.filter((rule) => rule.nomineeId === nomineeId).length;
}

export function validateNomineeInput(input: {
  fullName: string;
  email: string;
  mobile: string;
  relationship: RelationshipOption | "";
}) {
  if (!input.fullName.trim()) {
    return "Full name is required.";
  }

  if (!input.email.trim() || !input.email.includes("@")) {
    return "Enter a valid email address.";
  }

  if (!input.mobile.trim() || input.mobile.replace(/[^0-9]/g, "").length < 8) {
    return "Enter a valid mobile number.";
  }

  if (!input.relationship) {
    return "Choose a relationship.";
  }

  return null;
}

export function validateAccessRuleInput(input: {
  nomineeId: string;
  accessCondition: string;
  categorySlug?: string | null;
  documentId?: string | null;
}) {
  if (!input.nomineeId) {
    return "Choose a nominee.";
  }

  if (!input.categorySlug && !input.documentId) {
    return "Select a category or document.";
  }

  if (!input.accessCondition.trim()) {
    return "Describe the access condition.";
  }

  return null;
}

export function createId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${random}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatStatusTone(status: RecordStatus) {
  if (status === "Verified") {
    return "success" as const;
  }

  if (status === "Pending review") {
    return "warning" as const;
  }

  if (status === "Restricted") {
    return "secondary" as const;
  }

  return "secondary" as const;
}

export function normalizeFileType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extension === "jpeg" ? "jpg" : extension;
}

export function isAllowedFileType(fileName: string, mimeType: string) {
  const extension = normalizeFileType(fileName);
  return RECORD_ALLOWED_EXTENSIONS.includes(extension as (typeof RECORD_ALLOWED_EXTENSIONS)[number]) || RECORD_ALLOWED_MIME_TYPES.includes(mimeType as (typeof RECORD_ALLOWED_MIME_TYPES)[number]);
}

export function validateRecordUpload(input: {
  title: string;
  categorySlug: string;
  vaultId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}) {
  if (!input.title.trim()) {
    return "Title is required.";
  }

  if (!input.categorySlug) {
    return "Select a category.";
  }

  if (!input.vaultId) {
    return "Choose a vault.";
  }

  if (!input.fileName) {
    return "Choose a file to upload.";
  }

  if (!isAllowedFileType(input.fileName, input.fileType)) {
    return "Only PDF, JPG and PNG files are allowed.";
  }

  if (input.fileSize > RECORD_MAX_FILE_SIZE_BYTES) {
    return "Files must be 10 MB or smaller.";
  }

  return null;
}

export function createAccessToken(recordId: string, action: "preview" | "download") {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `access-${action}-${recordId}-${suffix}`;
}

export function createTimestamp(minutesFromNow = 5) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

export function matchesSearch(record: ContinuityRecord, query: string, vaultName: string, categoryTitle: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    record.title,
    record.description,
    record.fileName,
    record.fileType,
    record.metadataNotes,
    record.status,
    record.tags.join(" "),
    vaultName,
    categoryTitle,
    record.checksum,
    record.encryptionReference,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function withinDateRange(dateValue: string, range: "all" | "7d" | "30d" | "90d" | "1y") {
  if (range === "all") {
    return true;
  }

  const startedAt = new Date(dateValue).getTime();
  const difference = Date.now() - startedAt;
  const thresholds = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
  } as const;

  return difference <= thresholds[range];
}
