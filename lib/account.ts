export type AccountRole = "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN";

export function inferAccountRole(
  role: string | null | undefined,
  permissions: ReadonlyArray<string> | null | undefined
): AccountRole | null {
  if (
    role === "CUSTOMER" ||
    role === "NOMINEE" ||
    role === "VERIFICATION_OFFICER" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN"
  ) {
    return role;
  }

  if (permissions?.some((permission) => permission.startsWith("SUPER_ADMIN_"))) {
    return "SUPER_ADMIN";
  }

  if (permissions?.some((permission) => permission.startsWith("ADMIN_"))) {
    return "ADMIN";
  }

  if (permissions?.some((permission) => permission.startsWith("VERIFICATION_"))) {
    return "VERIFICATION_OFFICER";
  }

  if (permissions?.some((permission) => permission.startsWith("NOMINEE_"))) {
    return "NOMINEE";
  }

  if (permissions?.some((permission) => permission.startsWith("USER_"))) {
    return "CUSTOMER";
  }

  return null;
}

export function getAccountLabel(role: string | null | undefined) {
  if (!role) {
    return "Signed-in account";
  }

  if (role === "CUSTOMER") return "Owner Account";
  if (role === "NOMINEE") return "Invited Nominee";
  if (role === "VERIFICATION_OFFICER") return "Verification Officer";
  if (role === "ADMIN") return "Administrator";
  if (role === "SUPER_ADMIN") return "Super Admin";

  return "Signed-in account";
}

export function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "IN"
  );
}
