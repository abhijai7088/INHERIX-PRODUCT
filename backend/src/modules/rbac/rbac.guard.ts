import type { UserRole } from "../auth/types.js";
import { HttpError } from "../../utils/http.js";
import { listRolePermissions, type RbacPermissionKey } from "./permissions.js";

export function hasPermission(permissions: ReadonlyArray<string>, permission: RbacPermissionKey) {
  return permissions.includes(permission);
}

export function hasAnyPermission(permissions: ReadonlyArray<string>, required: ReadonlyArray<RbacPermissionKey>) {
  return required.some((permission) => permissions.includes(permission));
}

export function hasRole(role: UserRole, allowedRoles: ReadonlyArray<UserRole>) {
  return allowedRoles.includes(role);
}

export function assertRole(role: UserRole, allowedRoles: ReadonlyArray<UserRole>, message = "Access is denied.") {
  if (!hasRole(role, allowedRoles)) {
    throw new HttpError(403, "FORBIDDEN", message);
  }
}

export function assertPermission(
  permissions: ReadonlyArray<string>,
  permission: RbacPermissionKey,
  message = "Access is denied."
) {
  if (!hasPermission(permissions, permission)) {
    throw new HttpError(403, "FORBIDDEN", message);
  }
}

export function assertAnyPermission(
  permissions: ReadonlyArray<string>,
  required: ReadonlyArray<RbacPermissionKey>,
  message = "Access is denied."
) {
  if (!hasAnyPermission(permissions, required)) {
    throw new HttpError(403, "FORBIDDEN", message);
  }
}

export function assertAuthenticated(userId: string | null | undefined, message = "Authentication is required.") {
  if (!userId) {
    throw new HttpError(401, "UNAUTHORIZED", message);
  }
}

export function assertCustomerOwnership(userId: string, customerId: string, message = "Customer scope is restricted to the owning account.") {
  if (userId !== customerId) {
    throw new HttpError(403, "FORBIDDEN", message);
  }
}

export function assertNomineeAssignment(assignmentExists: boolean, message = "No nominee assignment exists for the requested customer.") {
  if (!assignmentExists) {
    throw new HttpError(403, "FORBIDDEN", message);
  }
}

export function getDefaultPermissionsForRole(role: UserRole) {
  return listRolePermissions(role);
}
