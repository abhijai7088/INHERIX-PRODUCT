import {
  Activity,
  CheckSquare,
  FolderOpen,
  History as HistoryIcon,
  ShieldCheck,
  Settings,
  Upload,
  Users,
  LayoutDashboard,
  UserCog,
  Link2,
} from "lucide-react";
import type { ComponentType } from "react";
import type { AccountRole } from "@/lib/account";

export type NavigationItem = {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  requiredPermission?: string;
};

export type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

export function getActiveNavigationHref(pathname: string, items: NavigationItem[]) {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";

  const matches = items
    .filter((item) => {
      const normalizedHref = item.href.replace(/\/+$/, "") || "/";
      return normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`);
    })
    .sort((left, right) => right.href.length - left.href.length);

  return matches[0]?.href ?? null;
}

const customerNavigationSections: NavigationSection[] = [
  {
    title: "",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Digital Vault", href: "/dashboard/records", icon: FolderOpen },
      { title: "Nominees & Family", href: "/dashboard/family", icon: Users },
      { title: "Emergency Access", href: "/dashboard/emergency", icon: ShieldCheck },
      { title: "Family Readiness", href: "/dashboard/tasks", icon: CheckSquare },
      { title: "Connections", href: "/dashboard/connections", icon: Link2 },
      { title: "My Continuity Plan", href: "/dashboard/activation", icon: Activity },
      { title: "Settings", href: "/dashboard/profile", icon: Settings },
    ],
  },
];

const nomineeNavigationSections: NavigationSection[] = [
  {
    title: "Nominee Workflow",
    items: [
      { title: "Assigned Documents", href: "/dashboard/released-documents", icon: FolderOpen, requiredPermission: "NOMINEE_VIEW_RELEASED_DOCUMENT" },
      { title: "Proof Request Desk", href: "/dashboard/released-documents/request", icon: ShieldCheck, requiredPermission: "NOMINEE_RAISE_TRIGGER" },
      { title: "Proof Upload", href: "/dashboard/emergency/upload-proof", icon: Upload, requiredPermission: "NOMINEE_UPLOAD_PROOF" },
    ],
  },
];

const verificationNavigationSections: NavigationSection[] = [
  {
    title: "Operations",
    items: [
      { title: "Verification & Claims", href: "/dashboard/emergency/verification", icon: ShieldCheck, requiredPermission: "VERIFICATION_VIEW_ASSIGNED_CASE" },
    ],
  },
];

const adminNavigationSections: NavigationSection[] = [
  {
    title: "Operations",
    items: [
      { title: "Trigger Queue", href: "/dashboard/admin", icon: LayoutDashboard, requiredPermission: "ADMIN_VIEW_TRIGGER_QUEUE" },
      { title: "Release Console", href: "/dashboard/releases", icon: FolderOpen, requiredPermission: "ADMIN_RELEASE_DOCUMENT" },
    ],
  },
  {
    title: "Security & Governance",
    items: [
      { title: "Security Center", href: "/dashboard/security", icon: ShieldCheck, requiredPermission: "ADMIN_VIEW_SECURITY_EVENTS" },
      { title: "Audit Trail", href: "/dashboard/audit", icon: HistoryIcon, requiredPermission: "ADMIN_VIEW_AUDIT_LOG" },
    ],
  },
  {
    title: "Super Admin Control",
    items: [
      { title: "Admin & Officer Setup", href: "/dashboard/settings", icon: UserCog, requiredPermission: "SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS" },
      { title: "Officer Registry", href: "/dashboard/officers", icon: Users, requiredPermission: "SUPER_ADMIN_MANAGE_ADMINS" },
      { title: "Access Matrix", href: "/dashboard/rbac", icon: ShieldCheck, requiredPermission: "SUPER_ADMIN_MANAGE_PERMISSIONS" },
    ],
  },
];

export function getNavigationSectionsForRole(role: AccountRole | null | undefined) {
  if (role === "CUSTOMER") {
    return customerNavigationSections;
  }

  if (role === "NOMINEE") {
    return nomineeNavigationSections;
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return adminNavigationSections;
  }

  if (role === "VERIFICATION_OFFICER") {
    return verificationNavigationSections;
  }

  return [];
}

export const navigationSections = customerNavigationSections;
