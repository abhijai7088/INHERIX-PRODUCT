import {
  createAccessToken,
  createId,
  createTimestamp,
  formatDateTime,
  getRecordById,
  type AccessTicket,
  type AccessRule,
  type ContinuityRecord,
  type Nominee,
  type RecordCategorySlug,
} from "@/lib/records";
import type { TriggerRequest } from "@/lib/trigger-workflow";

export type DocumentReleaseStatus = "PENDING" | "RELEASED" | "REVOKED" | "COMPLETED";
export type ReleaseAction = "view" | "download";

export type DocumentRelease = {
  id: string;
  triggerRequestId: string;
  customerId: string;
  nomineeId: string;
  nomineeName: string;
  documentId: string;
  documentTitle: string;
  categorySlug: RecordCategorySlug;
  canView: boolean;
  canDownload: boolean;
  releaseStatus: DocumentReleaseStatus;
  releaseNotes: string;
  releasedBy: string;
  releasedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReleasedDocumentAccessLog = {
  id: string;
  releaseId: string;
  triggerRequestId: string;
  customerId: string;
  nomineeId: string;
  documentId: string;
  documentTitle: string;
  action: ReleaseAction;
  outcome: "success" | "denied";
  actorName: string;
  details: string;
  accessedAt: string;
};

export type ReleaseNotification = {
  id: string;
  releaseId: string;
  recipient: "admin" | "nominee";
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export type ReleaseEligibility = {
  record: ContinuityRecord;
  rule: AccessRule;
  isAlreadyReleased: boolean;
  existingRelease?: DocumentRelease;
};

export type CreateDocumentReleaseInput = {
  triggerRequest: TriggerRequest;
  nominee: Nominee;
  record: ContinuityRecord;
  rule: AccessRule;
  canView: boolean;
  canDownload: boolean;
  releaseNotes: string;
  releasedBy: string;
};

export function getApprovedTriggerRequests(triggerRequests: TriggerRequest[]) {
  return triggerRequests.filter((request) => request.status === "APPROVED");
}

export function getReleaseEligibleDocuments(
  triggerRequest: TriggerRequest | null,
  records: ContinuityRecord[],
  nominees: Nominee[],
  accessRules: AccessRule[],
  releases: DocumentRelease[]
) {
  if (!triggerRequest || triggerRequest.status !== "APPROVED") {
    return [] as ReleaseEligibility[];
  }

  const nominee = nominees.find((item) => item.id === triggerRequest.nomineeId);

  if (!nominee) {
    return [] as ReleaseEligibility[];
  }

  return records
    .filter((record) => !record.softDeleted)
    .flatMap((record) => {
      const rule = accessRules.find((item) => {
        if (item.nomineeId !== nominee.id || item.status !== "Active") {
          return false;
        }

        const matchesDocument = item.documentId === record.id;
        const matchesCategory = item.categorySlug === record.categorySlug;

        return matchesDocument || matchesCategory;
      });

      if (!rule || (!rule.canView && !rule.canDownload)) {
        return [];
      }

      const existingRelease = releases.find(
        (release) =>
          release.triggerRequestId === triggerRequest.id &&
          release.nomineeId === nominee.id &&
          release.documentId === record.id
      );

      return [
        {
          record,
          rule,
          isAlreadyReleased: Boolean(existingRelease),
          existingRelease,
        },
      ];
    });
}

export function getReleasedDocumentsForNominee(
  nomineeId: string,
  releases: DocumentRelease[],
  records: ContinuityRecord[]
) {
  return releases
    .filter((release) => release.nomineeId === nomineeId && (release.releaseStatus === "RELEASED" || release.releaseStatus === "COMPLETED"))
    .map((release) => ({
      release,
      record: getRecordById(records, release.documentId),
    }))
    .filter((entry): entry is { release: DocumentRelease; record: ContinuityRecord } => Boolean(entry.record));
}

export function getReleaseStatusTone(status: DocumentReleaseStatus) {
  if (status === "RELEASED" || status === "COMPLETED") {
    return "success" as const;
  }

  if (status === "PENDING") {
    return "warning" as const;
  }

  return "destructive" as const;
}

export function getReleaseStatusLabel(status: DocumentReleaseStatus) {
  if (status === "RELEASED") {
    return "Released";
  }

  if (status === "COMPLETED") {
    return "Completed";
  }

  if (status === "PENDING") {
    return "Pending";
  }

  return "Revoked";
}

export function createDocumentReleaseRecord(input: CreateDocumentReleaseInput): DocumentRelease {
  const now = new Date().toISOString();

  return {
    id: createId("release"),
    triggerRequestId: input.triggerRequest.id,
    customerId: input.triggerRequest.customerId,
    nomineeId: input.nominee.id,
    nomineeName: input.nominee.fullName,
    documentId: input.record.id,
    documentTitle: input.record.title,
    categorySlug: input.record.categorySlug,
    canView: input.canView,
    canDownload: input.canDownload,
    releaseStatus: "RELEASED",
    releaseNotes: input.releaseNotes.trim() || "Released after approved trigger review.",
    releasedBy: input.releasedBy,
    releasedAt: now,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function revokeDocumentReleaseRecord(release: DocumentRelease, revokedBy: string, notes: string) {
  const now = new Date().toISOString();

  return {
    ...release,
    releaseStatus: "REVOKED" as const,
    revokedAt: now,
    releaseNotes: notes.trim() || release.releaseNotes,
    releasedBy: revokedBy,
    updatedAt: now,
  };
}

export function buildReleasedDocumentAccessToken(release: DocumentRelease, action: ReleaseAction) {
  const ticketAction = action === "view" ? "preview" : "download";
  const ticket: AccessTicket = {
    recordId: release.documentId,
    action: ticketAction,
    token: createAccessToken(release.documentId, ticketAction),
    expiresAt: createTimestamp(5),
  };

  return ticket;
}

export function formatReleaseAuditLabel(release: DocumentRelease) {
  return `${release.documentTitle} • ${formatDateTime(release.updatedAt)}`;
}

export const defaultDocumentReleases: DocumentRelease[] = [
  {
    id: "release-bank-1",
    triggerRequestId: "trigger-request-approved",
    customerId: "customer-rahul",
    nomineeId: "nominee-amit",
    nomineeName: "Amit Tyagi",
    documentId: "record-bank",
    documentTitle: "Bank Reference Letter",
    categorySlug: "financial-information",
    canView: true,
    canDownload: false,
    releaseStatus: "RELEASED",
    releaseNotes: "Released for controlled preview only after medical trigger approval.",
    releasedBy: "Rahul Sharma",
    releasedAt: "2026-06-05T13:20:00.000Z",
    revokedAt: null,
    createdAt: "2026-06-05T13:20:00.000Z",
    updatedAt: "2026-06-05T13:20:00.000Z",
  },
  {
    id: "release-policy-1",
    triggerRequestId: "trigger-request-approved",
    customerId: "customer-rahul",
    nomineeId: "nominee-amit",
    nomineeName: "Amit Tyagi",
    documentId: "record-policy",
    documentTitle: "Insurance Policy",
    categorySlug: "financial-information",
    canView: true,
    canDownload: true,
    releaseStatus: "PENDING",
    releaseNotes: "Configured and awaiting final activation.",
    releasedBy: "Rahul Sharma",
    releasedAt: null,
    revokedAt: null,
    createdAt: "2026-06-05T13:25:00.000Z",
    updatedAt: "2026-06-05T13:25:00.000Z",
  },
  {
    id: "release-property-revoked",
    triggerRequestId: "trigger-request-approved",
    customerId: "customer-rahul",
    nomineeId: "nominee-amit",
    nomineeName: "Amit Tyagi",
    documentId: "record-property",
    documentTitle: "Property Deed",
    categorySlug: "family-assets",
    canView: true,
    canDownload: true,
    releaseStatus: "REVOKED",
    releaseNotes: "Release revoked before activation after a policy review.",
    releasedBy: "Rahul Sharma",
    releasedAt: "2026-06-05T13:30:00.000Z",
    revokedAt: "2026-06-05T13:45:00.000Z",
    createdAt: "2026-06-05T13:30:00.000Z",
    updatedAt: "2026-06-05T13:45:00.000Z",
  },
];

export const defaultReleasedDocumentAccessLogs: ReleasedDocumentAccessLog[] = [
  {
    id: "release-log-1",
    releaseId: "release-bank-1",
    triggerRequestId: "trigger-request-approved",
    customerId: "customer-rahul",
    nomineeId: "nominee-amit",
    documentId: "record-bank",
    documentTitle: "Bank Reference Letter",
    action: "view",
    outcome: "success",
    actorName: "Amit Tyagi",
    details: "Secure preview token issued after release authorization checks.",
    accessedAt: "2026-06-05T13:35:00.000Z",
  },
];

export const defaultReleaseNotifications: ReleaseNotification[] = [
  {
    id: "release-notification-1",
    releaseId: "release-bank-1",
    recipient: "nominee",
    title: "Document released to you",
    message: "Bank Reference Letter is now available for preview.",
    readAt: null,
    createdAt: "2026-06-05T13:20:00.000Z",
  },
  {
    id: "release-notification-2",
    releaseId: "release-policy-1",
    recipient: "admin",
    title: "Release pending activation",
    message: "Insurance Policy release is configured and waiting for activation.",
    readAt: null,
    createdAt: "2026-06-05T13:25:00.000Z",
  },
];
