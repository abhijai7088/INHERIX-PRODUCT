import { inferAccountRole, type AccountRole } from "@/lib/account";

export type FrontendUserRole = "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";

type FrontendSessionUser = {
  role: string;
  email: string;
  isEmailVerified: boolean;
  permissions?: string[];
};

type FrontendSessionData = {
  user?: FrontendSessionUser | null;
  nextPath?: string;
  permissions?: string[];
};

type FrontendSessionEnvelope = {
  data?: FrontendSessionData | null;
};

type RouteRule = {
  prefix: string;
  permission: string;
  allowedRoles: ReadonlyArray<AccountRole>;
};

const restrictedRouteRules: RouteRule[] = [
  { prefix: "/dashboard/verification", permission: "VERIFICATION_VIEW_ASSIGNED_CASE", allowedRoles: ["VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/emergency/verification", permission: "VERIFICATION_VIEW_ASSIGNED_CASE", allowedRoles: ["VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/emergency/upload-proof", permission: "NOMINEE_UPLOAD_PROOF", allowedRoles: ["CUSTOMER", "NOMINEE"] },
  { prefix: "/dashboard/officers", permission: "SUPER_ADMIN_MANAGE_ADMINS", allowedRoles: ["SUPER_ADMIN"] },
  { prefix: "/dashboard/releases/history", permission: "ADMIN_RELEASE_DOCUMENT", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/releases", permission: "ADMIN_RELEASE_DOCUMENT", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/records", permission: "USER_VIEW_OWN_VAULT", allowedRoles: ["CUSTOMER"] },
  { prefix: "/dashboard/family", permission: "USER_MANAGE_NOMINEE", allowedRoles: ["CUSTOMER"] },
  { prefix: "/dashboard/professionals", permission: "USER_MANAGE_ACCESS_RULE", allowedRoles: ["CUSTOMER"] },
  { prefix: "/dashboard/activation", permission: "USER_VIEW_OWN_VAULT", allowedRoles: ["CUSTOMER"] },
  { prefix: "/dashboard/tasks", permission: "USER_VIEW_OWN_VAULT", allowedRoles: ["CUSTOMER"] },
  { prefix: "/dashboard/emergency", permission: "USER_VIEW_OWN_VAULT", allowedRoles: ["CUSTOMER", "NOMINEE"] },
  { prefix: "/dashboard/vault", permission: "USER_VIEW_OWN_VAULT", allowedRoles: ["CUSTOMER"] },
  { prefix: "/dashboard/released-documents", permission: "NOMINEE_VIEW_RELEASED_DOCUMENT", allowedRoles: ["NOMINEE"] },
  { prefix: "/dashboard/admin", permission: "ADMIN_VIEW_TRIGGER_QUEUE", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/security", permission: "ADMIN_VIEW_SECURITY_EVENTS", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/governance", permission: "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS", allowedRoles: ["SUPER_ADMIN"] },
  { prefix: "/dashboard/audit", permission: "ADMIN_VIEW_AUDIT_LOG", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/backup", permission: "ADMIN_VIEW_AUDIT_LOG", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/logs", permission: "ADMIN_VIEW_AUDIT_LOG", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/reports", permission: "ADMIN_MANAGE_USERS_LIMITED", allowedRoles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard/settings", permission: "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS", allowedRoles: ["SUPER_ADMIN"] },
  { prefix: "/dashboard/rbac", permission: "SUPER_ADMIN_MANAGE_PERMISSIONS", allowedRoles: ["SUPER_ADMIN"] },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function hasPermission(user: FrontendSessionUser, permissions: ReadonlyArray<string>, permission: string) {
  if (permissions.includes(permission) || user.permissions?.includes(permission)) {
    return true;
  }

  return false;
}

function getDashboardHomePath(role: AccountRole | null) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "/dashboard/admin";
  }

  if (role === "VERIFICATION_OFFICER") {
    return "/dashboard/emergency/verification";
  }

  if (role === "NOMINEE") {
    return "/dashboard/released-documents";
  }

  return "/dashboard";
}

function getAccessDeniedPath(role: AccountRole | null, pathname: string) {
  const fallback = getDashboardHomePath(role);
  const search = new URLSearchParams({
    from: pathname,
    home: fallback,
  });

  return `/access-denied?${search.toString()}`;
}

export function getRouteAccessDecision(session: FrontendSessionEnvelope | null, pathname: string) {
  const user = session?.data?.user ?? null;

  if (!user) {
    return { allow: false, redirectTo: "/onboarding/login" };
  }

  if (!user.isEmailVerified) {
    return {
      allow: false,
      redirectTo: `/onboarding/verify-email?email=${encodeURIComponent(user.email)}`,
    };
  }

  const permissions = session?.data?.permissions ?? [];
  const role = inferAccountRole(user.role, permissions);
  const rule = restrictedRouteRules.find((candidate) => matchesPrefix(pathname, candidate.prefix));

  if (!rule) {
    return { allow: true, redirectTo: null };
  }

  if (role && !rule.allowedRoles.includes(role)) {
    return {
      allow: false,
      redirectTo: getAccessDeniedPath(role, pathname),
    };
  }

  if (rule.prefix === "/dashboard/emergency/upload-proof") {
    if (role === "NOMINEE" && hasPermission(user, permissions, "NOMINEE_UPLOAD_PROOF")) {
      return { allow: true, redirectTo: null };
    }

    if (role === "CUSTOMER" && hasPermission(user, permissions, "USER_VIEW_OWN_VAULT")) {
      return { allow: true, redirectTo: null };
    }

    return {
      allow: false,
      redirectTo: getAccessDeniedPath(role, pathname),
    };
  }

  if (hasPermission(user, permissions, rule.permission)) {
    return { allow: true, redirectTo: null };
  }

  return {
    allow: false,
    redirectTo: getAccessDeniedPath(role, pathname),
  };
}

export function getAuthenticatedLandingPath(session: FrontendSessionEnvelope | null) {
  return session?.data?.nextPath ?? "/dashboard";
}

export function getDashboardRoleLandingPath(session: FrontendSessionEnvelope | null) {
  const user = session?.data?.user ?? null;
  const permissions = session?.data?.permissions ?? [];
  const role = user ? inferAccountRole(user.role, permissions) : null;

  return getDashboardHomePath(role);
}
