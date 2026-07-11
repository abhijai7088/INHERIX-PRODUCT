import type {
  AuthStore,
  NomineeAssignmentRecord,
  PermissionRecord,
  RolePermissionRecord,
} from "../auth/auth.store.js";
import type { UserRole } from "../auth/types.js";
import type { AuthRequestContext } from "../auth/types.js";
import { HttpError } from "../../utils/http.js";
import {
  RBAC_PERMISSION_CATALOG,
  RBAC_ROLE_PERMISSION_KEYS,
  listRolePermissions,
  resolveDashboardLandingPath,
  type RbacPermissionKey,
} from "./permissions.js";
import { assertAnyPermission, assertPermission, assertRole } from "./rbac.guard.js";

export type AuthenticatedPrincipal = {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  session: {
    id: string;
  } | null;
  accessToken: string;
  authenticatedBy: "access" | "refresh";
};

export type RbacStore = Pick<
  AuthStore,
  | "listPermissions"
  | "findPermissionByKey"
  | "listPermissionsForRole"
  | "listPermissionsForUser"
  | "listRolePermissions"
  | "replaceRolePermissions"
  | "findNomineeAssignment"
  | "insertAuditLog"
  | "insertSecurityEvent"
> & {
  listPermissions(): Promise<PermissionRecord[]>;
  findPermissionByKey(permissionKey: string): Promise<PermissionRecord | null>;
  listPermissionsForRole(role: UserRole): Promise<string[]>;
  listPermissionsForUser(userId: string): Promise<string[]>;
  listRolePermissions(role?: UserRole): Promise<RolePermissionRecord[]>;
  replaceRolePermissions(role: UserRole, permissionKeys: RbacPermissionKey[]): Promise<RolePermissionRecord[]>;
  findNomineeAssignment(customerId: string, nomineeUserId: string): Promise<NomineeAssignmentRecord | null>;
};

export function createRbacService(store: RbacStore) {
  return {
    resolveDashboardLandingPath,
    listRolePermissions,
    async listPermissions() {
      return store.listPermissions();
    },
    async listPermissionsForRole(role: UserRole) {
      return store.listPermissionsForRole(role);
    },
    async listPermissionsForUser(userId: string) {
      return store.listPermissionsForUser(userId);
    },
    async listRolePermissionMappings(role?: UserRole) {
      return store.listRolePermissions(role);
    },
    async replaceRolePermissions(role: UserRole, permissionKeys: RbacPermissionKey[]) {
      return store.replaceRolePermissions(role, permissionKeys);
    },
    async getPrincipalPermissions(principal: AuthenticatedPrincipal) {
      const permissions = await store.listPermissionsForUser(principal.user.id);
      return permissions.length ? permissions : listRolePermissions(principal.user.role);
    },
    async getMe(principal: AuthenticatedPrincipal) {
      const permissions = await store.listPermissionsForUser(principal.user.id);

      return {
        userId: principal.user.id,
        role: principal.user.role,
        email: principal.user.email,
        sessionId: principal.session?.id ?? null,
        authenticatedBy: principal.authenticatedBy,
        permissions: permissions.length ? permissions : listRolePermissions(principal.user.role),
        dashboardPath: resolveDashboardLandingPath(principal.user.role),
      };
    },
    async getPermissionCatalog() {
      const permissions = await store.listPermissions();
      return permissions.length ? permissions : RBAC_PERMISSION_CATALOG;
    },
    async getRolePermissionSummary() {
      const mappings = await store.listRolePermissions();
      if (!mappings.length) {
        return Object.entries(RBAC_ROLE_PERMISSION_KEYS).map(([role, permissions]) => ({
          role: role as UserRole,
          permissions: [...new Set(permissions)],
        }));
      }

      const grouped = new Map<UserRole, Set<string>>();

      for (const mapping of mappings) {
        if (!grouped.has(mapping.role)) {
          grouped.set(mapping.role, new Set());
        }

        grouped.get(mapping.role)?.add(mapping.permissionKey);
      }

      return [...grouped.entries()].map(([role, permissions]) => ({
        role,
        permissions: [...permissions],
      }));
    },
    async ensurePermissionOrThrow(permissions: ReadonlyArray<string>, permission: RbacPermissionKey, message?: string) {
      assertPermission(permissions, permission, message);
    },
    async ensureAnyPermissionOrThrow(
      permissions: ReadonlyArray<string>,
      required: ReadonlyArray<RbacPermissionKey>,
      message?: string
    ) {
      assertAnyPermission(permissions, required, message);
    },
    async ensureRoleOrThrow(role: UserRole, allowedRoles: ReadonlyArray<UserRole>, message?: string) {
      assertRole(role, allowedRoles, message);
    },
    async ensureCustomerScopeOrThrow(principal: AuthenticatedPrincipal, customerId: string) {
      if (principal.user.role !== "CUSTOMER" || principal.user.id !== customerId) {
        throw new HttpError(403, "FORBIDDEN", "Customer scope is restricted to the owning account.");
      }
    },
    async ensureNomineeAssignmentOrThrow(principal: AuthenticatedPrincipal, customerId: string) {
      if (principal.user.role !== "NOMINEE") {
        throw new HttpError(403, "FORBIDDEN", "Nominee scope is restricted to nominee accounts.");
      }

      const assignment = await store.findNomineeAssignment(customerId, principal.user.id);
      if (!assignment || assignment.status === "REJECTED" || assignment.status === "REMOVED") {
        throw new HttpError(403, "FORBIDDEN", "No nominee assignment exists for the requested customer.");
      }

      return assignment;
    },
    async updateRolePermissions(
      principal: AuthenticatedPrincipal,
      input: {
        role: UserRole;
        permissionKeys: RbacPermissionKey[];
      },
      context: AuthRequestContext
    ) {
      const currentPermissions = await store.listPermissionsForUser(principal.user.id);
      assertPermission(
        currentPermissions,
        "SUPER_ADMIN_MANAGE_PERMISSIONS",
        "Only a super admin can change role-permission mappings."
      );

      const previousMappings = await store.listRolePermissions(input.role);
      const nextMappings = await store.replaceRolePermissions(input.role, input.permissionKeys);

      await store.insertAuditLog({
        userId: principal.user.id,
        role: principal.user.role,
        action: "ROLE_PERMISSION_MAPPING_CHANGED",
        moduleName: "rbac",
        entityType: "role_permissions",
        entityId: null,
        oldValue: {
          role: input.role,
          permissions: previousMappings.map((mapping) => mapping.permissionKey),
        },
        newValue: {
          role: input.role,
          permissions: nextMappings.map((mapping) => mapping.permissionKey),
        },
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
      });

      await store.insertSecurityEvent({
        userId: principal.user.id,
        eventType: "RBAC_PERMISSION_MAPPING_CHANGED",
        eventDescription: `Role permissions updated for ${input.role}.`,
        ipAddress: context.ipAddress,
        deviceInfo: context.deviceInfo,
        riskLevel: "MEDIUM",
      });

      return nextMappings;
    },
  };
}

export type RbacService = ReturnType<typeof createRbacService>;
