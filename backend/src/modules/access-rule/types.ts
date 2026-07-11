import type { UserRole } from "../auth/types.js";

export type AccessRuleScope = "DOCUMENT" | "CATEGORY";

export type AccessRuleReleaseCondition =
  | "DEATH_EVENT"
  | "MEDICAL_INCAPACITY"
  | "LEGAL_EVENT"
  | "EMERGENCY_ACCESS"
  | "OWNER_INACTIVE"
  | "OTHER";

export type AccessRuleAction = "CREATED" | "UPDATED" | "REVOKED" | "DELETED" | "REACTIVATED";

export type AccessRuleStatus = "ACTIVE" | "REVOKED" | "DELETED";

export type DocumentAccessRuleRecord = {
  id: string;
  customerId: string;
  nomineeId: string;
  documentId: string | null;
  categoryId: string | null;
  scopeType: AccessRuleScope;
  canView: boolean;
  canDownload: boolean;
  releaseCondition: AccessRuleReleaseCondition;
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
  status: AccessRuleStatus;
};

export type AccessRuleHistoryRecord = {
  id: string;
  accessRuleId: string;
  action: AccessRuleAction;
  customerId: string;
  nomineeId: string;
  performedBy: string | null;
  performedRole: UserRole | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
};

export type AccessRuleCreateInput = {
  nomineeId: string;
  documentId?: string | null;
  categoryId?: string | null;
  canView: boolean;
  canDownload: boolean;
  releaseCondition: AccessRuleReleaseCondition;
  conditionNotes: string | null;
};

export type AccessRuleUpdateInput = {
  nomineeId?: string | null;
  documentId?: string | null;
  categoryId?: string | null;
  canView?: boolean | null;
  canDownload?: boolean | null;
  releaseCondition?: AccessRuleReleaseCondition | null;
  conditionNotes?: string | null;
};

export type AccessRuleFilterInput = {
  nomineeId?: string | null;
  documentId?: string | null;
  categoryId?: string | null;
  status?: AccessRuleStatus | null;
};

export type AccessRulePrincipal = {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};

export type AccessRuleNomineeRecord = {
  id: string;
  customerId: string;
  fullName: string;
  email: string | null;
  status: string;
};

export type AccessRuleDocumentRecord = {
  id: string;
  customerId: string;
  documentTitle: string;
  categoryId: string;
  categoryName: string;
};

export type AccessRuleCategoryRecord = {
  id: string;
  categoryName: string;
  isActive: boolean;
};

export type AccessRuleListResponse = {
  rules: DocumentAccessRuleRecord[];
};

export type AccessRuleDetailResponse = {
  rule: DocumentAccessRuleRecord;
  history: AccessRuleHistoryRecord[];
};

