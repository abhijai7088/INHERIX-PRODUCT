import { backendJsonFetch } from "./auth-state";
import { parseBackendJsonResponse } from "./backend-api";

export type AccessRuleRecord = {
  id: string;
  customerId: string;
  nomineeId: string;
  documentId: string | null;
  categoryId: string | null;
  scopeType: "DOCUMENT" | "CATEGORY";
  canView: boolean;
  canDownload: boolean;
  releaseCondition:
    | "DEATH_EVENT"
    | "MEDICAL_INCAPACITY"
    | "LEGAL_EVENT"
    | "EMERGENCY_ACCESS"
    | "OWNER_INACTIVE"
    | "OTHER";
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
};

export type AccessRuleHistoryRecord = {
  id: string;
  accessRuleId: string;
  action: "CREATED" | "UPDATED" | "REVOKED" | "DELETED" | "REACTIVATED";
  customerId: string;
  nomineeId: string;
  performedBy: string | null;
  performedRole: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
};

export type AccessRuleDetailResponse = {
  rule: AccessRuleRecord;
  history: AccessRuleHistoryRecord[];
};

export type AccessRuleListResponse = {
  rules: AccessRuleRecord[];
};

export type AccessRuleCreateInput = {
  nomineeId: string;
  documentId?: string | null;
  categoryId?: string | null;
  canView: boolean;
  canDownload: boolean;
  releaseCondition: AccessRuleRecord["releaseCondition"];
  conditionNotes?: string | null;
};

export type AccessRuleUpdateInput = Partial<AccessRuleCreateInput>;

export async function loadAccessRules(query?: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      search.set(key, value);
    }
  }

  const response = await backendJsonFetch(`/access-rules${search.toString() ? `?${search.toString()}` : ""}`);
  return parseBackendJsonResponse<AccessRuleListResponse>(response, "The access rule request could not be completed.");
}

export async function loadAccessRule(ruleId: string) {
  const response = await backendJsonFetch(`/access-rules/${encodeURIComponent(ruleId)}`);
  return parseBackendJsonResponse<AccessRuleDetailResponse>(response, "The access rule request could not be completed.");
}

export async function createAccessRule(input: AccessRuleCreateInput) {
  const response = await backendJsonFetch("/access-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return parseBackendJsonResponse<AccessRuleDetailResponse>(response, "The access rule request could not be completed.");
}

export async function updateAccessRule(ruleId: string, input: AccessRuleUpdateInput) {
  const response = await backendJsonFetch(`/access-rules/${encodeURIComponent(ruleId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return parseBackendJsonResponse<AccessRuleDetailResponse>(response, "The access rule request could not be completed.");
}

export async function revokeAccessRule(ruleId: string) {
  const response = await backendJsonFetch(`/access-rules/${encodeURIComponent(ruleId)}/revoke`, {
    method: "POST",
  });

  return parseBackendJsonResponse<AccessRuleDetailResponse>(response, "The access rule request could not be completed.");
}

export async function reactivateAccessRule(ruleId: string) {
  const response = await backendJsonFetch(`/access-rules/${encodeURIComponent(ruleId)}/reactivate`, {
    method: "POST",
  });

  return parseBackendJsonResponse<AccessRuleDetailResponse>(response, "The access rule request could not be completed.");
}

export async function deleteAccessRule(ruleId: string) {
  const response = await backendJsonFetch(`/access-rules/${encodeURIComponent(ruleId)}`, {
    method: "DELETE",
  });

  return parseBackendJsonResponse<AccessRuleDetailResponse>(response, "The access rule request could not be completed.");
}
