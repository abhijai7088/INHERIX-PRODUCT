import { createId, type RelationshipOption } from "@/lib/records";

export type TriggerRequestKind =
  | "death"
  | "medical"
  | "legal"
  | "court-order"
  | "other"
  | "document-access";

export type TriggerRequestPriority = "Low" | "Medium" | "High" | "Critical";

export type TriggerRequestStatus =
  | "DRAFT"
  | "PENDING"
  | "UNDER_REVIEW"
  | "ADDITIONAL_INFO_REQUIRED"
  | "PENDING_SUPER_ADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type TriggerActorRole = "nominee" | "admin" | "system";
export type TriggerProofStatus = "UPLOADED" | "VERIFIED" | "REJECTED";

export type TriggerRequest = {
  id: string;
  customerId: string;
  nomineeId: string;
  nomineeName: string;
  nomineeEmail: string;
  nomineeMobile: string;
  relationship: RelationshipOption;
  customRelationship?: string;
  requestKind: TriggerRequestKind;
  subjectLine: string;
  summary: string;
  priority: TriggerRequestPriority;
  status: TriggerRequestStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  additionalInfoRequestedAt: string | null;
  additionalInfoReason: string;
  adminDecisionNote: string;
  latestProofId: string | null;
  proofCount: number;
  latestActivityAt: string;
  createdAt: string;
  updatedAt: string;
  lastActionBy: string;
  lastActionRole: TriggerActorRole;
};

export type TriggerProof = {
  id: string;
  requestId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  notes: string;
  uploadedBy: string;
  uploadedByRole: TriggerActorRole;
  createdAt: string;
};

export type TriggerNote = {
  id: string;
  requestId: string;
  body: string;
  authorName: string;
  authorRole: TriggerActorRole;
  createdAt: string;
};

export type TriggerTimelineEntry = {
  id: string;
  requestId: string;
  action: string;
  status: TriggerRequestStatus;
  actorName: string;
  actorRole: TriggerActorRole;
  summary: string;
  createdAt: string;
};

export type TriggerNotification = {
  id: string;
  requestId: string;
  recipient: "nominee" | "admin";
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export type TriggerWorkflowState = {
  requests: TriggerRequest[];
  proofs: TriggerProof[];
  notes: TriggerNote[];
  timeline: TriggerTimelineEntry[];
  notifications: TriggerNotification[];
  latestRequestId: string | null;
};

export const triggerRequestKinds: Array<{
  label: string;
  value: TriggerRequestKind;
  description: string;
}> = [
  {
    label: "Death certificate",
    value: "death",
    description: "Used when the emergency release is tied to a death certificate or estate filing.",
  },
  {
    label: "Medical emergency",
    value: "medical",
    description: "Used for urgent hospital, treatment, or incapacity verification.",
  },
  {
    label: "Legal requirement",
    value: "legal",
    description: "Used when a legal notice or compliance requirement has been issued.",
  },
  {
    label: "Court order",
    value: "court-order",
    description: "Used when a court order or tribunal instruction is provided.",
  },
  {
    label: "Other",
    value: "other",
    description: "Used when the request does not fit the other response types.",
  },
  {
    label: "Document access",
    value: "document-access",
    description: "Used when a nominee is requesting access to a specific customer document.",
  },
];

export const triggerRequestPriorities: Array<{
  label: string;
  value: TriggerRequestPriority;
}> = [
  { label: "Low", value: "Low" },
  { label: "Medium", value: "Medium" },
  { label: "High", value: "High" },
  { label: "Critical", value: "Critical" },
];

export const triggerRequestStatusLabels: Record<TriggerRequestStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  ADDITIONAL_INFO_REQUIRED: "Additional info required",
  PENDING_SUPER_ADMIN_APPROVAL: "Awaiting final approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const triggerProofStatusLabels: Record<TriggerProofStatus, string> = {
  UPLOADED: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export function getTriggerStatusTone(status: TriggerRequestStatus) {
  if (status === "APPROVED") {
    return "success" as const;
  }

  if (status === "PENDING" || status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED") {
    return "warning" as const;
  }

  if (status === "PENDING_SUPER_ADMIN_APPROVAL") {
    return "warning" as const;
  }

  if (status === "REJECTED" || status === "CANCELLED") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function getTriggerProofStatusTone(status: TriggerProofStatus) {
  if (status === "VERIFIED") {
    return "success" as const;
  }

  if (status === "REJECTED") {
    return "destructive" as const;
  }

  return "warning" as const;
}

export function getTriggerPriorityTone(priority: TriggerRequestPriority) {
  if (priority === "Critical") {
    return "destructive" as const;
  }

  if (priority === "High") {
    return "warning" as const;
  }

  if (priority === "Medium") {
    return "default" as const;
  }

  return "secondary" as const;
}

export function formatTriggerRequestKind(kind: TriggerRequestKind) {
  return triggerRequestKinds.find((item) => item.value === kind)?.label ?? "Other";
}

export function getTriggerRequestById(requests: TriggerRequest[], id: string) {
  return requests.find((request) => request.id === id);
}

export function getLatestTriggerRequest(requests: TriggerRequest[]) {
  return [...requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function countTriggerProofs(proofs: TriggerProof[], requestId: string) {
  return proofs.filter((proof) => proof.requestId === requestId).length;
}

export function countTriggerNotes(notes: TriggerNote[], requestId: string) {
  return notes.filter((note) => note.requestId === requestId).length;
}

export function formatTriggerActor(role: TriggerActorRole) {
  if (role === "admin") {
    return "Admin reviewer";
  }

  if (role === "system") {
    return "System";
  }

  return "Nominee";
}

export function buildTriggerTimelineEntry(input: {
  requestId: string;
  action: string;
  status: TriggerRequestStatus;
  actorName: string;
  actorRole: TriggerActorRole;
  summary: string;
}): TriggerTimelineEntry {
  return {
    id: createId("trigger-timeline"),
    requestId: input.requestId,
    action: input.action,
    status: input.status,
    actorName: input.actorName,
    actorRole: input.actorRole,
    summary: input.summary,
    createdAt: new Date().toISOString(),
  };
}

export function buildTriggerNotification(input: {
  requestId: string;
  recipient: "nominee" | "admin";
  title: string;
  message: string;
}): TriggerNotification {
  return {
    id: createId("trigger-notification"),
    requestId: input.requestId,
    recipient: input.recipient,
    title: input.title,
    message: input.message,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}

export const defaultTriggerRequests: TriggerRequest[] = [
  {
    id: "trigger-request-approved",
    customerId: "customer-rahul",
    nomineeId: "nominee-amit",
    nomineeName: "Amit Tyagi",
    nomineeEmail: "amit@example.com",
    nomineeMobile: "+91 9999999999",
    relationship: "brother",
    requestKind: "medical",
    subjectLine: "Approved hospital release case",
    summary: "Hospital documentation and identity proof were verified for selective controlled release.",
    priority: "High",
    status: "APPROVED",
    submittedAt: "2026-06-05T09:15:00.000Z",
    reviewedAt: "2026-06-05T13:10:00.000Z",
    resolvedAt: "2026-06-05T13:10:00.000Z",
    cancelledAt: null,
    additionalInfoRequestedAt: null,
    additionalInfoReason: "",
    adminDecisionNote: "Approved for selective release after proof validation.",
    latestProofId: "trigger-proof-approved-1",
    proofCount: 2,
    latestActivityAt: "2026-06-05T13:10:00.000Z",
    createdAt: "2026-06-05T09:00:00.000Z",
    updatedAt: "2026-06-05T13:10:00.000Z",
    lastActionBy: "Rahul Sharma",
    lastActionRole: "admin",
  },
  {
    id: "trigger-request-aml",
    customerId: "customer-rahul",
    nomineeId: "nominee-amit",
    nomineeName: "Amit Tyagi",
    nomineeEmail: "amit@example.com",
    nomineeMobile: "+91 9999999999",
    relationship: "brother",
    requestKind: "medical",
    subjectLine: "Emergency release for hospital verification",
    summary: "Hospital discharge summary and doctor note uploaded for continuity review.",
    priority: "High",
    status: "UNDER_REVIEW",
    submittedAt: "2026-06-08T09:25:00.000Z",
    reviewedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    additionalInfoRequestedAt: null,
    additionalInfoReason: "",
    adminDecisionNote: "",
    latestProofId: "trigger-proof-aml-1",
    proofCount: 2,
    latestActivityAt: "2026-06-08T11:15:00.000Z",
    createdAt: "2026-06-08T09:10:00.000Z",
    updatedAt: "2026-06-08T11:15:00.000Z",
    lastActionBy: "Amit Tyagi",
    lastActionRole: "nominee",
  },
  {
    id: "trigger-request-neha",
    customerId: "customer-rahul",
    nomineeId: "nominee-neha",
    nomineeName: "Neha Sharma",
    nomineeEmail: "neha@example.com",
    nomineeMobile: "+91 9666666666",
    relationship: "daughter",
    requestKind: "legal",
    subjectLine: "Additional relationship proof required",
    summary: "Owner asked for a certified relationship document before release can continue.",
    priority: "Medium",
    status: "ADDITIONAL_INFO_REQUIRED",
    submittedAt: "2026-06-07T13:00:00.000Z",
    reviewedAt: "2026-06-08T08:40:00.000Z",
    resolvedAt: null,
    cancelledAt: null,
    additionalInfoRequestedAt: "2026-06-08T08:40:00.000Z",
    additionalInfoReason: "Please attach a certified relationship proof and updated government ID.",
    adminDecisionNote: "Queue held until the relationship evidence is refreshed.",
    latestProofId: "trigger-proof-neha-1",
    proofCount: 1,
    latestActivityAt: "2026-06-08T08:40:00.000Z",
    createdAt: "2026-06-07T12:50:00.000Z",
    updatedAt: "2026-06-08T08:40:00.000Z",
    lastActionBy: "Rahul Sharma",
    lastActionRole: "admin",
  },
  {
    id: "trigger-request-draft",
    customerId: "customer-rahul",
    nomineeId: "nominee-rahul",
    nomineeName: "Rahul Sharma",
    nomineeEmail: "rahul@example.com",
    nomineeMobile: "+91 9876543210",
    relationship: "spouse",
    requestKind: "other",
    subjectLine: "Draft emergency request",
    summary: "A draft request is being prepared for later proof submission.",
    priority: "Low",
    status: "CANCELLED",
    submittedAt: null,
    reviewedAt: null,
    resolvedAt: "2026-05-30T09:10:00.000Z",
    cancelledAt: "2026-05-30T09:10:00.000Z",
    additionalInfoRequestedAt: null,
    additionalInfoReason: "",
    adminDecisionNote: "",
    latestProofId: null,
    proofCount: 0,
    latestActivityAt: "2026-05-30T09:10:00.000Z",
    createdAt: "2026-05-30T09:00:00.000Z",
    updatedAt: "2026-05-30T09:10:00.000Z",
    lastActionBy: "Rahul Sharma",
    lastActionRole: "admin",
  },
];

export const defaultTriggerProofs: TriggerProof[] = [
  {
    id: "trigger-proof-approved-1",
    requestId: "trigger-request-approved",
    fileName: "Identity-Verification.pdf",
    fileType: "application/pdf",
    fileSize: 940_000,
    notes: "Identity and hospital papers combined for release review.",
    uploadedBy: "Amit Tyagi",
    uploadedByRole: "nominee",
    createdAt: "2026-06-05T10:10:00.000Z",
  },
  {
    id: "trigger-proof-approved-2",
    requestId: "trigger-request-approved",
    fileName: "Hospital-Letter.pdf",
    fileType: "application/pdf",
    fileSize: 620_000,
    notes: "Supporting hospital letter used during approval.",
    uploadedBy: "Amit Tyagi",
    uploadedByRole: "nominee",
    createdAt: "2026-06-05T11:40:00.000Z",
  },
  {
    id: "trigger-proof-aml-1",
    requestId: "trigger-request-aml",
    fileName: "Hospital-Discharge-Summary.pdf",
    fileType: "application/pdf",
    fileSize: 1_140_000,
    notes: "Includes discharge summary and doctor sign-off.",
    uploadedBy: "Amit Tyagi",
    uploadedByRole: "nominee",
    createdAt: "2026-06-08T10:05:00.000Z",
  },
  {
    id: "trigger-proof-aml-2",
    requestId: "trigger-request-aml",
    fileName: "Doctor-Certificate.pdf",
    fileType: "application/pdf",
    fileSize: 820_000,
    notes: "Supporting medical certificate for review.",
    uploadedBy: "Amit Tyagi",
    uploadedByRole: "nominee",
    createdAt: "2026-06-08T11:15:00.000Z",
  },
  {
    id: "trigger-proof-neha-1",
    requestId: "trigger-request-neha",
    fileName: "Relationship-Proof.pdf",
    fileType: "application/pdf",
    fileSize: 710_000,
    notes: "Initial relationship proof uploaded before the additional info request.",
    uploadedBy: "Neha Sharma",
    uploadedByRole: "nominee",
    createdAt: "2026-06-07T13:15:00.000Z",
  },
];

export const defaultTriggerNotes: TriggerNote[] = [
  {
    id: "trigger-note-aml-1",
    requestId: "trigger-request-aml",
    body: "Please review the doctor certificate alongside the discharge summary.",
    authorName: "Rahul Sharma",
    authorRole: "admin",
    createdAt: "2026-06-08T11:18:00.000Z",
  },
  {
    id: "trigger-note-neha-1",
    requestId: "trigger-request-neha",
    body: "Please provide a certified relationship proof and a current government ID.",
    authorName: "Rahul Sharma",
    authorRole: "admin",
    createdAt: "2026-06-08T08:40:00.000Z",
  },
];

export const defaultTriggerTimeline: TriggerTimelineEntry[] = [
  {
    id: "trigger-timeline-approved-1",
    requestId: "trigger-request-approved",
    action: "Request submitted",
    status: "PENDING",
    actorName: "Amit Tyagi",
    actorRole: "nominee",
    summary: "Approved case submitted for medical continuity release.",
    createdAt: "2026-06-05T09:15:00.000Z",
  },
  {
    id: "trigger-timeline-approved-2",
    requestId: "trigger-request-approved",
    action: "Proof uploaded",
    status: "UNDER_REVIEW",
    actorName: "Amit Tyagi",
    actorRole: "nominee",
    summary: "Hospital and identity proof uploaded for review.",
    createdAt: "2026-06-05T11:40:00.000Z",
  },
  {
    id: "trigger-timeline-approved-3",
    requestId: "trigger-request-approved",
    action: "Request approved",
    status: "APPROVED",
    actorName: "Rahul Sharma",
    actorRole: "admin",
    summary: "Approved for selective document release after proof validation.",
    createdAt: "2026-06-05T13:10:00.000Z",
  },
  {
    id: "trigger-timeline-1",
    requestId: "trigger-request-aml",
    action: "Request submitted",
    status: "PENDING",
    actorName: "Amit Tyagi",
    actorRole: "nominee",
    summary: "Emergency request submitted for review and proof validation.",
    createdAt: "2026-06-08T09:25:00.000Z",
  },
  {
    id: "trigger-timeline-2",
    requestId: "trigger-request-aml",
    action: "Proof uploaded",
    status: "UNDER_REVIEW",
    actorName: "Amit Tyagi",
    actorRole: "nominee",
    summary: "Medical documents uploaded and queued for review.",
    createdAt: "2026-06-08T11:15:00.000Z",
  },
  {
    id: "trigger-timeline-3",
    requestId: "trigger-request-neha",
    action: "Additional info required",
    status: "ADDITIONAL_INFO_REQUIRED",
    actorName: "Rahul Sharma",
    actorRole: "admin",
    summary: "Queue paused until relationship evidence is refreshed.",
    createdAt: "2026-06-08T08:40:00.000Z",
  },
  {
    id: "trigger-timeline-4",
    requestId: "trigger-request-draft",
    action: "Request cancelled",
    status: "CANCELLED",
    actorName: "Rahul Sharma",
    actorRole: "admin",
    summary: "Seeded draft request archived so the live workflow stays available.",
    createdAt: "2026-05-30T09:10:00.000Z",
  },
];

export const defaultTriggerNotifications: TriggerNotification[] = [
  {
    id: "trigger-notification-approved-1",
    requestId: "trigger-request-approved",
    recipient: "admin",
    title: "Approved case ready for release",
    message: "Amit Tyagi's approved trigger case is eligible for controlled release.",
    readAt: null,
    createdAt: "2026-06-05T13:10:00.000Z",
  },
  {
    id: "trigger-notification-1",
    requestId: "trigger-request-neha",
    recipient: "nominee",
    title: "Additional information requested",
    message: "Please upload the certified relationship proof and updated government ID.",
    readAt: null,
    createdAt: "2026-06-08T08:40:00.000Z",
  },
  {
    id: "trigger-notification-2",
    requestId: "trigger-request-aml",
    recipient: "admin",
    title: "New emergency request in review",
    message: "Amit Tyagi's emergency request has moved into the review queue.",
    readAt: null,
    createdAt: "2026-06-08T11:15:00.000Z",
  },
];
