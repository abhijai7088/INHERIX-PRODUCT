/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { backendBinaryFetch, backendJsonFetch } from "@/lib/auth-state";
import { getAuditLogs, getNotifications, type NotificationItem } from "@/lib/observability-api";
import {
  createId,
  createTimestamp,
  formatDateTime,
  getVaultById,
  getRecordCategorySlugFromBackendCategoryName,
  type AccessRule,
  type AccessTicket,
  type AuditEntry,
  type ContinuityRecord,
  type CreateVaultInput,
  type Nominee,
  type NomineeStatus,
  type RelationshipOption,
  type UpdateRecordInput,
  type UploadRecordInput,
  type Vault,
  validateAccessRuleInput,
  validateNomineeInput,
  validateRecordUpload,
} from "@/lib/records";
import {
  buildTriggerNotification,
  buildTriggerTimelineEntry,
  getLatestTriggerRequest,
  type TriggerActorRole,
  type TriggerNote,
  type TriggerProof,
  type TriggerRequest,
  type TriggerRequestKind,
  type TriggerRequestPriority,
  type TriggerTimelineEntry,
  type TriggerNotification,
} from "@/lib/trigger-workflow";
import {
  buildReleasedDocumentAccessToken,
  type DocumentRelease,
  type ReleaseAction,
  type ReleaseNotification,
  type ReleasedDocumentAccessLog,
} from "@/lib/release-workflow";
import { formatRelationship, recordCategories, getCategoryBySlug } from "@/lib/records";

type RecordsState = {
  documentCategories: Array<{
    id: string;
    categoryName: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
  vaults: Vault[];
  records: ContinuityRecord[];
  nominees: Nominee[];
  accessRules: AccessRule[];
  audits: AuditEntry[];
  notifications: NotificationItem[];
  dashboardStats: {
    vaultsCount: number;
    documentsCount: number;
    nomineesCount: number;
    activeRulesCount: number;
    recentActivity: Array<{
      id: string;
      action: string;
      entityType: string | null;
      createdAt: string;
    }>;
  } | null;
  auditLogs: Array<{
    id: string;
    action: string;
    moduleName: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
  }>;
  latestAccess: AccessTicket | null;
  triggerRequests: TriggerRequest[];
  triggerProofs: TriggerProof[];
  triggerNotes: TriggerNote[];
  triggerTimeline: TriggerTimelineEntry[];
  triggerNotifications: TriggerNotification[];
  latestTriggerRequestId: string | null;
  documentReleases: DocumentRelease[];
  releaseAccessLogs: ReleasedDocumentAccessLog[];
  releaseNotifications: ReleaseNotification[];
};

type RecordsContextValue = RecordsState & {
  createVault: (input: CreateVaultInput) => Promise<Vault>;
  uploadRecord: (
    input: UploadRecordInput & {
      file?: File | null;
      categoryId?: string | null;
      onStage?: (stage: "validating" | "requesting-upload" | "uploading" | "finalizing") => void;
    }
  ) => Promise<{ ok: true; record: ContinuityRecord } | { ok: false; error: string }>;
  updateRecord: (input: UpdateRecordInput) => Promise<{ ok: true; record: ContinuityRecord } | { ok: false; error: string }>;
  viewRecord: (recordId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  archiveRecord: (recordId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  softDeleteRecord: (recordId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  requestSecureAccess: (recordId: string, action: "preview" | "download") => { ok: true; ticket: AccessTicket } | { ok: false; error: string };
  inviteNominee: (input: {
    fullName: string;
    email: string;
    mobile: string;
    relationship: RelationshipOption;
    customRelationship?: string;
    notes?: string;
  }) => Promise<{ ok: true; nominee: Nominee } | { ok: false; error: string }>;
  updateNominee: (input: {
    id: string;
    fullName: string;
    email: string;
    mobile: string;
    relationship: RelationshipOption;
    customRelationship?: string;
    status: NomineeStatus;
    notes: string;
  }) => Promise<{ ok: true; nominee: Nominee } | { ok: false; error: string }>;
  resendNomineeInvite: (nomineeId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeNominee: (nomineeId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  acceptNomineeInvitation: (nomineeId: string) => Promise<{ ok: true; nominee: Nominee } | { ok: false; error: string }>;
  addAccessRule: (input: {
    nomineeId: string;
    documentId?: string | null;
    categorySlug?: string | null;
    canView: boolean;
    canDownload: boolean;
    accessCondition: string;
  }) => Promise<{ ok: true; rule: AccessRule } | { ok: false; error: string }>;
  updateAccessRule: (input: {
    id: string;
    nomineeId: string;
    documentId?: string | null;
    categorySlug?: string | null;
    canView: boolean;
    canDownload: boolean;
    accessCondition: string;
    status: AccessRule["status"];
  }) => Promise<{ ok: true; rule: AccessRule } | { ok: false; error: string }>;
  deleteAccessRule: (ruleId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  clearLatestAccess: () => void;
  createTriggerRequest: (input: {
    nomineeId: string;
    requestKind: TriggerRequestKind;
    subjectLine: string;
    summary: string;
    priority: TriggerRequestPriority;
  }) => Promise<{ ok: true; request: TriggerRequest } | { ok: false; error: string }>;
  submitTriggerRequest: (requestId: string) => Promise<{ ok: true; request: TriggerRequest } | { ok: false; error: string }>;
  uploadTriggerProof: (input: {
    requestId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    notes: string;
    uploadedBy?: string;
    uploadedByRole?: TriggerActorRole;
  }) => Promise<{ ok: true; request: TriggerRequest; proof: TriggerProof } | { ok: false; error: string }>;
  submitTriggerAdditionalInfo: (input: {
    requestId: string;
    note: string;
    submittedBy?: string;
  }) => Promise<{ ok: true; request: TriggerRequest; note: TriggerNote } | { ok: false; error: string }>;
  requestTriggerAdditionalInfo: (requestId: string, reason: string) => Promise<{ ok: true; request: TriggerRequest } | { ok: false; error: string }>;
  approveTriggerRequest: (requestId: string, note?: string) => Promise<{ ok: true; request: TriggerRequest } | { ok: false; error: string }>;
  rejectTriggerRequest: (requestId: string, note?: string) => Promise<{ ok: true; request: TriggerRequest } | { ok: false; error: string }>;
  cancelTriggerRequest: (requestId: string, note?: string) => Promise<{ ok: true; request: TriggerRequest } | { ok: false; error: string }>;
  markTriggerNotificationRead: (notificationId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  createDocumentRelease: (input: {
    triggerRequestId: string;
    documentId: string;
    canView: boolean;
    canDownload: boolean;
    releaseNotes: string;
  }) => Promise<{ ok: true; release: DocumentRelease } | { ok: false; error: string }>;
  updateDocumentRelease: (input: {
    releaseId: string;
    canView: boolean;
    canDownload: boolean;
    releaseNotes: string;
    releaseStatus: DocumentRelease["releaseStatus"];
  }) => Promise<{ ok: true; release: DocumentRelease } | { ok: false; error: string }>;
  revokeDocumentRelease: (releaseId: string, notes?: string) => Promise<{ ok: true; release: DocumentRelease } | { ok: false; error: string }>;
  requestReleasedDocumentAccess: (input: {
    releaseId: string;
    action: ReleaseAction;
    nomineeId: string;
  }) => { ok: true; ticket: AccessTicket } | { ok: false; error: string };
  markReleaseNotificationRead: (notificationId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const RecordsContext = createContext<RecordsContextValue | null>(null);

function emptyState(): RecordsState {
  return {
    documentCategories: [],
    vaults: [],
    records: [],
    nominees: [],
    accessRules: [],
    audits: [],
    notifications: [],
    dashboardStats: null,
    auditLogs: [],
    latestAccess: null,
    triggerRequests: [],
    triggerProofs: [],
    triggerNotes: [],
    triggerTimeline: [],
    triggerNotifications: [],
    latestTriggerRequestId: null,
    documentReleases: [],
    releaseAccessLogs: [],
    releaseNotifications: [],
  };
}

function apiError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
    ? (payload as { message: string }).message
    : fallback;
}

async function readApiPayload<T>(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(apiError(payload, fallbackMessage));
  }
  return (payload?.data ?? payload) as T;
}

function mapVault(vault: { id: string; vaultName: string; description: string | null; status: string; customerId: string; createdAt: string; updatedAt: string }): Vault {
  return {
    id: vault.id,
    name: vault.vaultName,
    description: vault.description ?? "",
    status: vault.status === "LOCKED" ? "Locked" : vault.status === "NEEDS_REVIEW" ? "Needs review" : "Active",
    ownerName: vault.customerId,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt,
    recordPolicy: "Encrypted storage with signed access only",
  };
}

function mapDocument(document: {
  id: string;
  vaultId: string;
  categoryId: string;
  categoryName: string;
  documentTitle: string;
  documentDescription: string | null;
  originalFileName: string | null;
  encryptedFilePath: string;
  fileMimeType: string | null;
  fileSize: number | null;
  fileHash: string | null;
  encryptionKeyRef: string | null;
  status: string;
  uploadedAt: string;
  updatedAt: string;
}) {
  const category = getRecordCategorySlugFromBackendCategoryName(document.categoryName) ?? getCategoryBySlug("legal-documents").slug;
  const resolvedCategory = recordCategories.find((item) => item.slug === category) ?? getCategoryBySlug("legal-documents");
  return {
    id: document.id,
    title: document.documentTitle,
    description: document.documentDescription ?? "",
    categorySlug: resolvedCategory.slug,
    vaultId: document.vaultId,
    fileName: document.originalFileName ?? document.documentTitle,
    fileType: document.fileMimeType ?? "application/octet-stream",
    fileSize: document.fileSize ?? 0,
    storageKey: document.encryptedFilePath,
    encryptionReference: document.encryptionKeyRef ?? "",
    checksum: document.fileHash ?? "",
    status: document.status === "ARCHIVED" ? "Archived" : document.status === "DELETED" ? "Archived" : "Verified",
    previewAllowed: true,
    downloadAllowed: document.status === "ACTIVE",
    softDeleted: document.status === "DELETED",
    uploadedAt: document.uploadedAt,
    updatedAt: document.updatedAt,
    metadataNotes: document.documentDescription ?? "",
    tags: [resolvedCategory.slug],
  } satisfies ContinuityRecord;
}

function mapNominee(item: {
  id: string;
  customerId: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  relationship: string;
  customRelationship: string | null;
  notes: string | null;
  status: "INVITED" | "ACTIVE" | "REJECTED" | "REMOVED";
  invitationStatus: "SENT" | "PENDING" | "ACCEPTED" | "REMOVED";
  invitedAt: string;
  acceptedAt: string | null;
  removedAt: string | null;
  updatedAt: string;
  assignedCount: number;
}): Nominee {
  return {
    id: item.id,
    customerId: item.customerId,
    fullName: item.fullName,
    email: item.email ?? "",
    mobile: item.mobile ?? "",
    relationship: (item.relationship as RelationshipOption) ?? "other",
    customRelationship: item.customRelationship ?? undefined,
    status: item.status === "REJECTED" ? "REJECTED" : item.status === "REMOVED" ? "REMOVED" : item.status === "ACTIVE" ? "ACTIVE" : "INVITED",
    invitationStatus: item.invitationStatus,
    invitedAt: item.invitedAt,
    acceptedAt: item.acceptedAt,
    removedAt: item.removedAt,
    createdAt: item.invitedAt,
    updatedAt: item.updatedAt,
    assignedRecordIds: [],
    assignedCategorySlugs: [],
    notes: item.notes ?? "",
  };
}

function mapAccessRule(item: {
  id: string;
  customerId: string;
  nomineeId: string;
  documentId: string | null;
  categoryId: string | null;
  scopeType: "DOCUMENT" | "CATEGORY";
  canView: boolean;
  canDownload: boolean;
  releaseCondition: string;
  conditionNotes: string | null;
  isActive: boolean;
  revokedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nomineeFullName: string;
  nomineeEmail: string | null;
  documentTitle: string | null;
  categoryName: string | null;
  status: "ACTIVE" | "REVOKED" | "DELETED";
}): AccessRule {
  return {
    id: item.id,
    customerId: item.customerId,
    nomineeId: item.nomineeId,
    documentId: item.documentId,
    categorySlug: (item.categoryId as AccessRule["categorySlug"]) ?? null,
    canView: item.canView,
    canDownload: item.canDownload,
    accessCondition: item.conditionNotes ?? item.releaseCondition,
    status: item.status === "ACTIVE" ? "Active" : item.status === "REVOKED" ? "Revoked" : "Pending",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapTriggerRequest(item: {
  id: string;
  customerId: string;
  nomineeId: string;
  nomineeName: string;
  nomineeEmail: string | null;
  nomineeMobile: string | null;
  relationship: string;
  customRelationship: string | null;
  requestKind: TriggerRequestKind;
  subjectLine: string;
  summary: string;
  priority: TriggerRequestPriority;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  additionalInfoRequestedAt: string | null;
  additionalInfoReason: string | null;
  adminDecisionNote: string | null;
  latestActivityAt: string;
  createdAt: string;
  updatedAt: string;
  requestedByUserId: string | null;
  lastActionByUserId: string | null;
  lastActionByName: string | null;
  lastActionRole: TriggerActorRole;
  proofCount?: number;
  latestProofId?: string | null;
}): TriggerRequest {
  return {
    id: item.id,
    customerId: item.customerId,
    nomineeId: item.nomineeId,
    nomineeName: item.nomineeName,
    nomineeEmail: item.nomineeEmail ?? "",
    nomineeMobile: item.nomineeMobile ?? "",
    relationship: (item.relationship as RelationshipOption) ?? "other",
    customRelationship: item.customRelationship ?? undefined,
    requestKind: item.requestKind,
    subjectLine: item.subjectLine,
    summary: item.summary,
    priority: item.priority,
    status: item.status as TriggerRequest["status"],
    submittedAt: item.submittedAt,
    reviewedAt: item.reviewedAt,
    resolvedAt: item.resolvedAt,
    cancelledAt: item.cancelledAt,
    additionalInfoRequestedAt: item.additionalInfoRequestedAt,
    additionalInfoReason: item.additionalInfoReason ?? "",
    adminDecisionNote: item.adminDecisionNote ?? "",
    latestProofId: item.latestProofId ?? null,
    proofCount: item.proofCount ?? 0,
    latestActivityAt: item.latestActivityAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastActionBy: item.lastActionByName ?? "",
    lastActionRole: item.lastActionRole,
  };
}

function mapRelease(item: {
  id: string;
  triggerRequestId: string;
  customerId: string;
  nomineeId: string;
  nomineeName: string;
  nomineeUserId: string | null;
  documentId: string;
  documentTitle: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  categoryId: string;
  categoryName: string;
  canView: boolean;
  canDownload: boolean;
  releaseStatus: "PENDING" | "RELEASED" | "REVOKED";
  releaseNotes: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): DocumentRelease {
  return {
    id: item.id,
    triggerRequestId: item.triggerRequestId,
    customerId: item.customerId,
    nomineeId: item.nomineeId,
    nomineeName: item.nomineeName,
    documentId: item.documentId,
    documentTitle: item.documentTitle,
    categorySlug: "legal-documents",
    canView: item.canView,
    canDownload: item.canDownload,
    releaseStatus: item.releaseStatus,
    releaseNotes: item.releaseNotes ?? "",
    releasedBy: item.releasedBy ?? "",
    releasedAt: item.releasedAt,
    revokedAt: item.revokedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function loadState(): Promise<RecordsState> {
  const [categoriesPayload, vaultsPayload, documentsPayload, nomineesPayload, accessRulesPayload, triggerPayload, releasePayload, releasedPayload, dashboardPayload, auditPayload, notificationsPayload] = await Promise.all([
    backendJsonFetch("/document-categories").then((response) => readApiPayload<{ categories: Array<any> }>(response, "Unable to load document categories")).catch(() => ({ categories: [] })),
    backendJsonFetch("/vaults").then((response) => readApiPayload<{ vaults: Array<any> }>(response, "Unable to load vaults")),
    backendJsonFetch("/documents").then((response) => readApiPayload<{ documents: Array<any> }>(response, "Unable to load documents")),
    backendJsonFetch("/nominees").then((response) => readApiPayload<{ nominees: Array<any> }>(response, "Unable to load nominees")),
    backendJsonFetch("/access-rules").then((response) => readApiPayload<{ rules: Array<any> }>(response, "Unable to load access rules")).catch(() => ({ rules: [] })),
    backendJsonFetch("/trigger-requests").then((response) => readApiPayload<{ requests: Array<any> }>(response, "Unable to load trigger requests")).catch(() => ({ requests: [] })),
    backendJsonFetch("/releases").then((response) => readApiPayload<any>(response, "Unable to load releases")).catch(() => ({})),
    backendJsonFetch("/released-documents").then((response) => readApiPayload<any>(response, "Unable to load released documents")).catch(() => ({})),
    backendJsonFetch("/dashboard/customer").then((response) => readApiPayload<{ stats: RecordsState["dashboardStats"] }>(response, "Unable to load dashboard stats")).catch(() => ({ stats: null })),
    getAuditLogs(5).catch(() => ({ logs: [], complianceReports: [], scope: "own" as const })),
    getNotifications(10).catch(() => ({ notifications: [], unreadCount: 0, notificationsReadAt: 0 })),
  ]);

  const documentCategories = (categoriesPayload.categories ?? []).map((category: any) => ({
    id: category.id,
    categoryName: category.categoryName,
    description: category.description ?? null,
    isActive: Boolean(category.isActive),
    createdAt: category.createdAt ?? new Date().toISOString(),
  }));
  const vaults = (vaultsPayload.vaults ?? []).map(mapVault);
  const records = (documentsPayload.documents ?? []).map(mapDocument);
  const nominees = (nomineesPayload.nominees ?? []).map(mapNominee);
  const accessRules = (accessRulesPayload.rules ?? []).map(mapAccessRule);
  const triggerRequests = (triggerPayload.requests ?? []).map(mapTriggerRequest);
  const documentReleases = ((releasePayload?.releases ?? releasedPayload?.releases ?? []) as Array<any>).map(mapRelease);
  const notifications = (notificationsPayload.notifications ?? []) as NotificationItem[];
  const releaseNotifications: ReleaseNotification[] = [
    ...((releasePayload?.notifications ?? []) as Array<any>).map((notification) => ({
      id: notification.id,
      releaseId: notification.releaseId ?? notification.metadata?.releaseId ?? "",
      recipient: "admin" as const,
      title: notification.title,
      message: notification.message,
      readAt: notification.readAt ?? null,
      createdAt: notification.createdAt,
    })),
    ...((releasedPayload?.notifications ?? []) as Array<any>).map((notification) => ({
      id: notification.id,
      releaseId: notification.releaseId ?? notification.metadata?.releaseId ?? "",
      recipient: "nominee" as const,
      title: notification.title,
      message: notification.message,
      readAt: notification.readAt ?? null,
      createdAt: notification.createdAt,
    })),
  ];

  return {
    documentCategories,
    vaults,
    records,
    nominees,
    accessRules,
    audits: [],
    notifications,
    dashboardStats: dashboardPayload.stats ?? null,
    auditLogs: (auditPayload.logs ?? []).map((entry) => ({
      id: entry.id,
      action: entry.type,
      moduleName: entry.moduleName ?? entry.domain,
      entityType: entry.entityType,
      entityId: entry.entityId,
      createdAt: entry.occurredAt,
    })),
    latestAccess: null,
    triggerRequests,
    triggerProofs: [],
    triggerNotes: [],
    triggerTimeline: [],
    triggerNotifications: triggerRequests.slice(0, 5).map((request) =>
      buildTriggerNotification({
        requestId: request.id,
        recipient: "admin",
        title: request.subjectLine,
        message: request.summary,
      })
    ),
    latestTriggerRequestId: getLatestTriggerRequest(triggerRequests)?.id ?? null,
    documentReleases,
    releaseAccessLogs: ((releasePayload?.accessLogs ?? releasedPayload?.accessLogs ?? []) as Array<any>).map((log) => ({
      id: log.id,
      releaseId: log.releaseId,
      triggerRequestId: log.triggerRequestId,
      customerId: log.customerId,
      nomineeId: log.nomineeId,
      documentId: log.documentId,
      documentTitle: log.documentTitle,
      action: log.action,
      actorName: log.actorName,
      ipAddress: log.ipAddress,
      deviceInfo: log.deviceInfo,
      outcome: log.outcome ?? (log.action === "FAILED_ACCESS" ? "denied" : "success"),
      details: log.details ?? `${log.documentTitle} ${log.action === "FAILED_ACCESS" ? "access was denied" : "access recorded"}.`,
      accessedAt: log.accessedAt,
    })),
    releaseNotifications,
  };
}

async function refreshState(setState: React.Dispatch<React.SetStateAction<RecordsState>>) {
  const next = await loadState();
  setState(next);
}

export function RecordsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecordsState>(emptyState);
  const documentCategoryIdBySlug = useMemo(() => {
    return Object.fromEntries(
      state.documentCategories.flatMap((category) => {
        const slug = getRecordCategorySlugFromBackendCategoryName(category.categoryName);
        return slug ? [[slug, category.id]] : [];
      })
    ) as Record<string, string>;
  }, [state.documentCategories]);

  useEffect(() => {
    void refreshState(setState).catch(() => {
      setState(emptyState());
    });
  }, []);

  const createVault = useCallback(async (input: CreateVaultInput) => {
    const response = await backendJsonFetch("/vaults", {
      method: "POST",
      body: JSON.stringify({
        vaultName: input.name,
        description: input.description,
      }),
    });
    const payload = await readApiPayload<{ vault: any }>(response, "Unable to create vault");
    await refreshState(setState);
    return mapVault(payload.vault);
  }, []);

  const uploadRecord = useCallback(async (input: UploadRecordInput & {
    file?: File | null;
    categoryId?: string | null;
    onStage?: (stage: "validating" | "requesting-upload" | "uploading" | "finalizing") => void;
  }) => {
    input.onStage?.("validating");
    const validationError = validateRecordUpload({
      title: input.title,
      categorySlug: input.categorySlug,
      vaultId: input.vaultId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
    });
    if (validationError) {
      return { ok: false as const, error: validationError };
    }

    if (!input.file) {
      return { ok: false as const, error: "Choose a document to upload." };
    }

    input.onStage?.("requesting-upload");
    const uploadResponse = await backendJsonFetch("/documents/upload", {
      method: "POST",
      body: JSON.stringify({
        vaultId: input.vaultId,
        categoryId: input.categoryId ?? (input.categorySlug ? documentCategoryIdBySlug[input.categorySlug] ?? null : null),
        documentTitle: input.title,
        documentDescription: input.description,
        originalFileName: input.fileName,
        fileMimeType: input.fileType,
        fileSize: input.fileSize,
        fileHash: null,
      }),
    });
    const uploadPayload = await readApiPayload<{ document: any; upload: { url: string; requiredHeaders: Record<string, string> } }>(uploadResponse, "Unable to start upload");
    const uploadHeaders = new Headers(uploadPayload.upload.requiredHeaders);

    try {
      input.onStage?.("uploading");
      const storageResponse = await fetch(uploadPayload.upload.url, {
        method: "PUT",
        headers: uploadHeaders,
        body: input.file,
      });

      if (!storageResponse.ok) {
        throw new Error(`Storage upload failed with status ${storageResponse.status}.`);
      }
    } catch (storageError) {
      try {
        input.onStage?.("uploading");
        const relayResponse = await backendBinaryFetch(`/documents/${encodeURIComponent(uploadPayload.document.id)}/content`, {
          method: "PUT",
          body: input.file,
          headers: input.fileType ? { "Content-Type": input.fileType } : undefined,
        });
        const relayPayload = await relayResponse.json().catch(() => null);

        if (!relayResponse.ok) {
          throw new Error(apiError(relayPayload, "Unable to relay the file to storage."));
        }

        input.onStage?.("finalizing");
        await refreshState(setState);
        return { ok: true as const, record: mapDocument(uploadPayload.document) };
      } catch (relayError) {
        try {
          await backendJsonFetch(`/documents/${encodeURIComponent(uploadPayload.document.id)}`, { method: "DELETE" });
        } catch {
          // Best-effort cleanup only.
        }

        throw new Error(
          relayError instanceof Error
            ? `Unable to upload the file to storage. ${relayError.message} Check S3 bucket access, CORS, credentials, and KMS permissions.`
            : "Unable to upload the file to storage. Check S3 bucket access, CORS, credentials, and KMS permissions."
        );
      }
    }

    input.onStage?.("finalizing");
    await refreshState(setState);
    const record = mapDocument(uploadPayload.document);
    return { ok: true as const, record };
  }, []);

  const updateRecord = useCallback(async (input: UpdateRecordInput) => {
    const categoryId = documentCategoryIdBySlug[input.categorySlug] ?? null;
    if (!categoryId) {
      return { ok: false as const, error: "Document categories are not available yet. Please refresh and try again." };
    }

    const response = await backendJsonFetch(`/documents/${encodeURIComponent(input.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        documentTitle: input.title,
        documentDescription: input.description,
        categoryId,
        status: input.downloadAllowed ? "ACTIVE" : "ARCHIVED",
      }),
    });
    const payload = await readApiPayload<{ document: any }>(response, "Unable to update record");
    await refreshState(setState);
    return { ok: true as const, record: mapDocument(payload.document) };
  }, [documentCategoryIdBySlug]);

  const viewRecord = useCallback(async (recordId: string) => {
    const response = await backendJsonFetch(`/documents/${encodeURIComponent(recordId)}`);
    await readApiPayload(response, "Unable to load record");
    return { ok: true as const };
  }, []);

  const archiveRecord = useCallback(async (recordId: string) => {
    const response = await backendJsonFetch(`/documents/${encodeURIComponent(recordId)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    await readApiPayload(response, "Unable to archive record");
    await refreshState(setState);
    return { ok: true as const };
  }, []);

  const softDeleteRecord = useCallback(async (recordId: string) => {
    const response = await backendJsonFetch(`/documents/${encodeURIComponent(recordId)}`, {
      method: "DELETE",
    });
    await readApiPayload(response, "Unable to delete record");
    await refreshState(setState);
    return { ok: true as const };
  }, []);

  const requestSecureAccess = useCallback((recordId: string, action: "preview" | "download") => {
    const record = state.records.find((item) => item.id === recordId);
    if (!record) {
      return { ok: false as const, error: "Record not found." };
    }
    return { ok: true as const, ticket: { recordId, action, token: `${action}-${recordId}-${createId("access")}`, expiresAt: createTimestamp(5) } };
  }, [state.records]);

  const inviteNominee = useCallback(async (input: {
    fullName: string;
    email: string;
    mobile: string;
    relationship: RelationshipOption;
    customRelationship?: string;
    notes?: string;
  }) => {
    const validationError = validateNomineeInput(input);
    if (validationError) {
      return { ok: false as const, error: validationError };
    }
    const response = await backendJsonFetch("/nominees", {
      method: "POST",
      body: JSON.stringify({
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        relationship: input.relationship,
        customRelationship: input.customRelationship ?? null,
        notes: input.notes ?? null,
      }),
    });
    const payload = await readApiPayload<{ nominee: any }>(response, "Unable to invite nominee");
    await refreshState(setState);
    return { ok: true as const, nominee: mapNominee(payload.nominee) };
  }, []);

  const updateNominee = useCallback(async (input: any) => {
    const response = await backendJsonFetch(`/nominees/${encodeURIComponent(input.id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    const payload = await readApiPayload<{ nominee: any }>(response, "Unable to update nominee");
    await refreshState(setState);
    return { ok: true as const, nominee: mapNominee(payload.nominee) };
  }, []);

  const resendNomineeInvite = useCallback(async (nomineeId: string) => {
    await readApiPayload(await backendJsonFetch(`/nominees/${encodeURIComponent(nomineeId)}/resend-invite`, { method: "POST" }), "Unable to resend invite");
    await refreshState(setState);
    return { ok: true as const };
  }, []);

  const removeNominee = useCallback(async (nomineeId: string) => {
    await readApiPayload(await backendJsonFetch(`/nominees/${encodeURIComponent(nomineeId)}`, { method: "DELETE" }), "Unable to remove nominee");
    await refreshState(setState);
    return { ok: true as const };
  }, []);

  const acceptNomineeInvitation = useCallback(async (nomineeId: string) => {
    await refreshState(setState);
    const nominee = state.nominees.find((item) => item.id === nomineeId);
    if (!nominee) {
      return { ok: false as const, error: "Nominee not found." };
    }
    return { ok: true as const, nominee };
  }, [state.nominees]);

  const addAccessRule = useCallback(async (input: {
    nomineeId: string;
    documentId?: string | null;
    categorySlug?: string | null;
    canView: boolean;
    canDownload: boolean;
    accessCondition: string;
  }) => {
    const validationError = validateAccessRuleInput(input);
    if (validationError) {
      return { ok: false as const, error: validationError };
    }
    const response = await backendJsonFetch("/access-rules", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const payload = await readApiPayload<{ rule: any }>(response, "Unable to create access rule");
    await refreshState(setState);
    return { ok: true as const, rule: mapAccessRule(payload.rule) };
  }, []);

  const updateAccessRule = useCallback(async (input: any) => {
    const response = await backendJsonFetch(`/access-rules/${encodeURIComponent(input.id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    const payload = await readApiPayload<{ rule: any }>(response, "Unable to update access rule");
    await refreshState(setState);
    return { ok: true as const, rule: mapAccessRule(payload.rule) };
  }, []);

  const deleteAccessRule = useCallback(async (ruleId: string) => {
    await readApiPayload(await backendJsonFetch(`/access-rules/${encodeURIComponent(ruleId)}`, { method: "DELETE" }), "Unable to delete access rule");
    await refreshState(setState);
    return { ok: true as const };
  }, []);

  const createTriggerRequest = useCallback(async (input: any) => {
    const response = await backendJsonFetch("/trigger-requests", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const payload = await readApiPayload<{ request: any }>(response, "Unable to create trigger request");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request) };
  }, []);

  const submitTriggerRequest = useCallback(async (requestId: string) => {
    const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/submit`, { method: "POST" });
    const payload = await readApiPayload<{ request: any }>(response, "Unable to submit trigger request");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request) };
  }, []);

  const uploadTriggerProof = useCallback(async (input: any) => {
    const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(input.requestId)}/proofs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const payload = await readApiPayload<{ request: any; proof: any }>(response, "Unable to upload proof");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request), proof: payload.proof as TriggerProof };
  }, []);

  const submitTriggerAdditionalInfo = useCallback(async (input: any) => {
    const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(input.requestId)}/more-info`, {
      method: "POST",
      body: JSON.stringify({ reason: input.note }),
    });
    const payload = await readApiPayload<{ request: any }>(response, "Unable to submit additional info");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request), note: { id: createId("trigger-note"), requestId: input.requestId, body: input.note, authorName: input.submittedBy ?? "System", authorRole: "admin" as TriggerActorRole, createdAt: new Date().toISOString() } };
  }, []);

  const requestTriggerAdditionalInfo = useCallback(async (requestId: string, reason: string) => {
    const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/more-info`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    const payload = await readApiPayload<{ request: any }>(response, "Unable to request more info");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request) };
  }, []);

  const approveTriggerRequest = useCallback(async (requestId: string, note?: string) => {
    const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ adminRemarks: note ?? null }),
    });
    const payload = await readApiPayload<{ request: any }>(response, "Unable to approve trigger request");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request) };
  }, []);

  const rejectTriggerRequest = useCallback(async (requestId: string, note?: string) => {
    const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/reject`, {
      method: "POST",
      body: JSON.stringify({ adminRemarks: note ?? null }),
    });
    const payload = await readApiPayload<{ request: any }>(response, "Unable to reject trigger request");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request) };
  }, []);

  const cancelTriggerRequest = useCallback(async (requestId: string, note?: string) => {
    const response = await backendJsonFetch(`/trigger-requests/${encodeURIComponent(requestId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: note ?? null }),
    });
    const payload = await readApiPayload<{ request: any }>(response, "Unable to cancel trigger request");
    await refreshState(setState);
    return { ok: true as const, request: mapTriggerRequest(payload.request) };
  }, []);

  const markTriggerNotificationRead = useCallback(async (notificationId: string) => {
    setState((current) => ({
      ...current,
      triggerNotifications: current.triggerNotifications.map((item) => item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item),
    }));
    return { ok: true as const };
  }, []);

  const createDocumentRelease = useCallback(async (input: any) => {
    const response = await backendJsonFetch("/releases", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const payload = await readApiPayload<{ release: any }>(response, "Unable to create release");
    await refreshState(setState);
    return { ok: true as const, release: mapRelease(payload.release) };
  }, []);

  const updateDocumentRelease = useCallback(async (input: any) => {
    const response = await backendJsonFetch(`/releases/${encodeURIComponent(input.releaseId)}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const payload = await readApiPayload<{ release: any }>(response, "Unable to update release");
    await refreshState(setState);
    return { ok: true as const, release: mapRelease(payload.release) };
  }, []);

  const revokeDocumentRelease = useCallback(async (releaseId: string, notes?: string) => {
    const response = await backendJsonFetch(`/releases/${encodeURIComponent(releaseId)}/revoke`, {
      method: "POST",
      body: JSON.stringify({ notes: notes ?? null }),
    });
    const payload = await readApiPayload<{ release: any }>(response, "Unable to revoke release");
    await refreshState(setState);
    return { ok: true as const, release: mapRelease(payload.release) };
  }, []);

  const requestReleasedDocumentAccess = useCallback((input: { releaseId: string; action: ReleaseAction; nomineeId: string; }) => {
    const release = state.documentReleases.find((item) => item.id === input.releaseId);
    if (!release) return { ok: false as const, error: "Release not found." };
    return { ok: true as const, ticket: buildReleasedDocumentAccessToken(release, input.action) };
  }, [state.documentReleases]);

  const markReleaseNotificationRead = useCallback(async (notificationId: string) => {
    setState((current) => ({
      ...current,
      releaseNotifications: current.releaseNotifications.map((item) => item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item),
    }));
    return { ok: true as const };
  }, []);

  const clearLatestAccess = useCallback(() => {
    setState((current) => ({ ...current, latestAccess: null }));
  }, []);

  const value = useMemo<RecordsContextValue>(() => ({
    ...state,
    createVault,
    uploadRecord,
    updateRecord,
    viewRecord,
    archiveRecord,
    softDeleteRecord,
    requestSecureAccess,
    inviteNominee,
    updateNominee,
    resendNomineeInvite,
    removeNominee,
    acceptNomineeInvitation,
    addAccessRule,
    updateAccessRule,
    deleteAccessRule,
    clearLatestAccess,
    createTriggerRequest,
    submitTriggerRequest,
    uploadTriggerProof,
    submitTriggerAdditionalInfo,
    requestTriggerAdditionalInfo,
    approveTriggerRequest,
    rejectTriggerRequest,
    cancelTriggerRequest,
    markTriggerNotificationRead,
    createDocumentRelease,
    updateDocumentRelease,
    revokeDocumentRelease,
    requestReleasedDocumentAccess,
    markReleaseNotificationRead,
  }), [state, createVault, uploadRecord, updateRecord, viewRecord, archiveRecord, softDeleteRecord, requestSecureAccess, inviteNominee, updateNominee, resendNomineeInvite, removeNominee, acceptNomineeInvitation, addAccessRule, updateAccessRule, deleteAccessRule, clearLatestAccess, createTriggerRequest, submitTriggerRequest, uploadTriggerProof, submitTriggerAdditionalInfo, requestTriggerAdditionalInfo, approveTriggerRequest, rejectTriggerRequest, cancelTriggerRequest, markTriggerNotificationRead, createDocumentRelease, updateDocumentRelease, revokeDocumentRelease, requestReleasedDocumentAccess, markReleaseNotificationRead]);

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecordsStore() {
  const context = useContext(RecordsContext);
  if (!context) throw new Error("useRecordsStore must be used within RecordsProvider");
  return context;
}

export function getVaultRecordCount(vaults: Vault[], records: ContinuityRecord[], vaultId: string) {
  return records.filter((record) => record.vaultId === vaultId && !record.softDeleted).length;
}

export function getRecordVaultName(vaults: Vault[], record: ContinuityRecord) {
  return getVaultById(vaults, record.vaultId)?.name ?? "Unknown vault";
}

export function getLatestAuditLabel(entry: AuditEntry) {
  return `${entry.action} â€¢ ${formatDateTime(entry.createdAt)}`;
}
