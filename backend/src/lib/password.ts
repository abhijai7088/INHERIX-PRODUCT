import bcrypt from "bcryptjs";

export function passwordPolicyViolations(password: string) {
  const violations: string[] = [];

  if (password.length < 8) {
    violations.push("Password must be at least 8 characters long.");
  }

  if (!/[A-Z]/.test(password)) {
    violations.push("Password must include at least one uppercase letter.");
  }

  if (!/[a-z]/.test(password)) {
    violations.push("Password must include at least one lowercase letter.");
  }

  if (!/\d/.test(password)) {
    violations.push("Password must include at least one number.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    violations.push("Password must include at least one special character.");
  }

  return violations;
}

export async function hashPassword(password: string) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

