import { backendJsonFetch } from "@/lib/auth-state";
import { parseBackendJsonResponse } from "@/lib/backend-api";

export type RbacPermission = {
  id: string;
  permissionKey: string;
  description: string;
  module: string;
  createdAt: string;
};

export type RbacRolePermission = {
  role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";
  permissions: string[];
};

export type RbacAdminPayload = {
  permissions: RbacPermission[];
  rolePermissions: RbacRolePermission[];
};

function readBackend<T>(response: Response, fallbackMessage: string) {
  return parseBackendJsonResponse<T>(response, fallbackMessage);
}

export async function getRbacAdminData() {
  const response = await backendJsonFetch("/admin/rbac/permissions");
  return readBackend<RbacAdminPayload>(response, "Unable to load RBAC management data.");
}

export async function updateRolePermissions(role: RbacRolePermission["role"], permissionKeys: string[]) {
  const response = await backendJsonFetch("/admin/rbac/role-permissions", {
    method: "POST",
    body: JSON.stringify({ role, permissionKeys }),
  });

  return readBackend<{ role: string; permissions: Array<{ permissionKey: string }> }>(
    response,
    "Unable to update RBAC permissions."
  );
}
