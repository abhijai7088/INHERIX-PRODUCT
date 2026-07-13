import type { UserRole } from "../auth/types.js";

export type RbacPermissionKey =
  | "USER_CREATE_VAULT"
  | "USER_VIEW_OWN_VAULT"
  | "USER_UPLOAD_DOCUMENT"
  | "USER_VIEW_OWN_DOCUMENT"
  | "USER_DELETE_OWN_DOCUMENT"
  | "USER_MANAGE_NOMINEE"
  | "USER_MANAGE_ACCESS_RULE"
  | "USER_VIEW_OWN_AUDIT_LOG"
  | "NOMINEE_ACCEPT_INVITATION"
  | "NOMINEE_RAISE_TRIGGER"
  | "NOMINEE_UPLOAD_PROOF"
  | "NOMINEE_VIEW_TRIGGER_STATUS"
  | "NOMINEE_VIEW_RELEASED_DOCUMENT"
  | "NOMINEE_DOWNLOAD_RELEASED_DOCUMENT"
  | "VERIFICATION_VIEW_ASSIGNED_CASE"
  | "VERIFICATION_REVIEW_PROOF"
  | "VERIFICATION_REQUEST_MORE_INFO"
  | "VERIFICATION_ADD_REMARKS"
  | "ADMIN_VIEW_TRIGGER_QUEUE"
  | "ADMIN_VERIFY_PROOF"
  | "ADMIN_APPROVE_TRIGGER"
  | "ADMIN_REJECT_TRIGGER"
  | "ADMIN_RELEASE_DOCUMENT"
  | "ADMIN_VIEW_AUDIT_LOG"
  | "ADMIN_VIEW_SECURITY_EVENTS"
  | "ADMIN_MANAGE_USERS_LIMITED"
  | "SUPER_ADMIN_MANAGE_ADMINS"
  | "SUPER_ADMIN_MANAGE_PERMISSIONS"
  | "SUPER_ADMIN_VIEW_SYSTEM_AUDIT"
  | "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS";

export type PermissionDefinition = {
  permissionKey: RbacPermissionKey;
  description: string;
  module: string;
};

export const RBAC_PERMISSION_CATALOG: PermissionDefinition[] = [
  { permissionKey: "USER_CREATE_VAULT", description: "Create a vault for the active customer.", module: "vault" },
  { permissionKey: "USER_VIEW_OWN_VAULT", description: "View only the authenticated customer's own vault.", module: "vault" },
  { permissionKey: "USER_UPLOAD_DOCUMENT", description: "Upload documents into the authenticated customer's own vault.", module: "document" },
  { permissionKey: "USER_VIEW_OWN_DOCUMENT", description: "View the authenticated customer's own documents.", module: "document" },
  { permissionKey: "USER_DELETE_OWN_DOCUMENT", description: "Delete the authenticated customer's own documents.", module: "document" },
  { permissionKey: "USER_MANAGE_NOMINEE", description: "Invite and manage nominees for the authenticated customer's vault.", module: "nominee" },
  { permissionKey: "USER_MANAGE_ACCESS_RULE", description: "Create and manage access rules for the authenticated customer's vault.", module: "access-rule" },
  { permissionKey: "USER_VIEW_OWN_AUDIT_LOG", description: "Read the authenticated customer's own audit trail.", module: "audit" },
  { permissionKey: "NOMINEE_ACCEPT_INVITATION", description: "Accept a nominee invitation.", module: "nominee" },
  { permissionKey: "NOMINEE_RAISE_TRIGGER", description: "Raise a trigger request for an assigned customer.", module: "trigger" },
  { permissionKey: "NOMINEE_UPLOAD_PROOF", description: "Upload proof for a trigger request.", module: "trigger" },
  { permissionKey: "NOMINEE_VIEW_TRIGGER_STATUS", description: "View trigger request status for an assigned case.", module: "trigger" },
  { permissionKey: "NOMINEE_VIEW_RELEASED_DOCUMENT", description: "View documents explicitly released to the nominee.", module: "release" },
  { permissionKey: "NOMINEE_DOWNLOAD_RELEASED_DOCUMENT", description: "Download documents explicitly released to the nominee.", module: "release" },
  { permissionKey: "VERIFICATION_VIEW_ASSIGNED_CASE", description: "View only verification cases assigned to the officer.", module: "verification" },
  { permissionKey: "VERIFICATION_REVIEW_PROOF", description: "Review proof documents for assigned verification cases.", module: "verification" },
  { permissionKey: "VERIFICATION_REQUEST_MORE_INFO", description: "Request more proof for an assigned verification case.", module: "verification" },
  { permissionKey: "VERIFICATION_ADD_REMARKS", description: "Add verification remarks to an assigned case.", module: "verification" },
  { permissionKey: "ADMIN_VIEW_TRIGGER_QUEUE", description: "View the administrative trigger queue.", module: "admin" },
  { permissionKey: "ADMIN_VERIFY_PROOF", description: "Mark proof as verified or rejected.", module: "admin" },
  { permissionKey: "ADMIN_APPROVE_TRIGGER", description: "Approve a verified trigger request.", module: "admin" },
  { permissionKey: "ADMIN_REJECT_TRIGGER", description: "Reject a trigger request.", module: "admin" },
  { permissionKey: "ADMIN_RELEASE_DOCUMENT", description: "Release approved documents through the controlled workflow.", module: "release" },
  { permissionKey: "ADMIN_VIEW_AUDIT_LOG", description: "Read administrative audit logs.", module: "audit" },
  { permissionKey: "ADMIN_VIEW_SECURITY_EVENTS", description: "Read security events and incident records.", module: "security" },
  { permissionKey: "ADMIN_MANAGE_USERS_LIMITED", description: "Manage users with limited administrative scope.", module: "admin" },
  { permissionKey: "SUPER_ADMIN_MANAGE_ADMINS", description: "Manage administrative accounts.", module: "super-admin" },
  { permissionKey: "SUPER_ADMIN_MANAGE_PERMISSIONS", description: "Manage database-backed permission mappings.", module: "super-admin" },
  { permissionKey: "SUPER_ADMIN_VIEW_SYSTEM_AUDIT", description: "View the full platform audit trail.", module: "super-admin" },
  { permissionKey: "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS", description: "Manage global system settings.", module: "super-admin" },
];

export const RBAC_PERMISSION_KEYS = RBAC_PERMISSION_CATALOG.map((permission) => permission.permissionKey) as RbacPermissionKey[];

export const RBAC_ROLE_PERMISSION_KEYS: Record<UserRole, RbacPermissionKey[]> = {
  CUSTOMER: [
    "USER_CREATE_VAULT",
    "USER_VIEW_OWN_VAULT",
    "USER_UPLOAD_DOCUMENT",
    "USER_VIEW_OWN_DOCUMENT",
    "USER_DELETE_OWN_DOCUMENT",
    "USER_MANAGE_NOMINEE",
    "USER_MANAGE_ACCESS_RULE",
    "USER_VIEW_OWN_AUDIT_LOG",
  ],
  NOMINEE: [
    "NOMINEE_ACCEPT_INVITATION",
    "NOMINEE_RAISE_TRIGGER",
    "NOMINEE_UPLOAD_PROOF",
    "NOMINEE_VIEW_TRIGGER_STATUS",
    "NOMINEE_VIEW_RELEASED_DOCUMENT",
    "NOMINEE_DOWNLOAD_RELEASED_DOCUMENT",
  ],
  VERIFICATION_OFFICER: [
    "VERIFICATION_VIEW_ASSIGNED_CASE",
    "VERIFICATION_REVIEW_PROOF",
    "VERIFICATION_REQUEST_MORE_INFO",
    "VERIFICATION_ADD_REMARKS",
  ],
  ADMIN: [
    "ADMIN_VIEW_TRIGGER_QUEUE",
    "ADMIN_VERIFY_PROOF",
    "ADMIN_APPROVE_TRIGGER",
    "ADMIN_REJECT_TRIGGER",
    "ADMIN_RELEASE_DOCUMENT",
    "ADMIN_VIEW_AUDIT_LOG",
    "ADMIN_VIEW_SECURITY_EVENTS",
    "ADMIN_MANAGE_USERS_LIMITED",
  ],
  SUPER_ADMIN: [
    "VERIFICATION_VIEW_ASSIGNED_CASE",
    "VERIFICATION_REVIEW_PROOF",
    "VERIFICATION_REQUEST_MORE_INFO",
    "VERIFICATION_ADD_REMARKS",
    "ADMIN_VIEW_TRIGGER_QUEUE",
    "ADMIN_VERIFY_PROOF",
    "ADMIN_APPROVE_TRIGGER",
    "ADMIN_REJECT_TRIGGER",
    "ADMIN_RELEASE_DOCUMENT",
    "ADMIN_VIEW_AUDIT_LOG",
    "ADMIN_VIEW_SECURITY_EVENTS",
    "ADMIN_MANAGE_USERS_LIMITED",
    "SUPER_ADMIN_MANAGE_ADMINS",
    "SUPER_ADMIN_MANAGE_PERMISSIONS",
    "SUPER_ADMIN_VIEW_SYSTEM_AUDIT",
    "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS",
  ],
};

export const RBAC_DASHBOARD_LANDING_PATHS: Record<UserRole, string> = {
  CUSTOMER: "/dashboard",
  NOMINEE: "/dashboard/released-documents",
  VERIFICATION_OFFICER: "/dashboard/emergency/verification",
  ADMIN: "/dashboard/admin",
  SUPER_ADMIN: "/dashboard/admin",
};

export function listRolePermissions(role: UserRole): RbacPermissionKey[] {
  return [...new Set(RBAC_ROLE_PERMISSION_KEYS[role] ?? [])];
}

export function resolveDashboardLandingPath(role: UserRole) {
  return RBAC_DASHBOARD_LANDING_PATHS[role] ?? "/dashboard";
}

export function isRbacPermissionKey(value: string): value is RbacPermissionKey {
  return RBAC_PERMISSION_KEYS.includes(value as RbacPermissionKey);
}
