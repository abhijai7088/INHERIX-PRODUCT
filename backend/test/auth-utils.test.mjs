import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDuration } from "../dist/lib/crypto.js";
import { signJwt, verifyJwt } from "../dist/lib/jwt.js";
import { passwordPolicyViolations } from "../dist/lib/password.js";

test("password policy enforces the INHERIX minimum standard", () => {
  const violations = passwordPolicyViolations("password");
  assert.ok(violations.length > 0);
  assert.equal(passwordPolicyViolations("Password@123").length, 0);
});

test("duration parsing supports auth TTL values", () => {
  assert.equal(parseDuration("15m"), 15 * 60 * 1000);
  assert.equal(parseDuration("30d"), 30 * 24 * 60 * 60 * 1000);
});

test("jwt helpers sign and verify access tokens", () => {
  const token = signJwt({ sub: "user-123", tokenType: "access" }, "secret", 60_000);
  const payload = verifyJwt(token, "secret");

  assert.ok(payload);
  assert.equal(payload?.sub, "user-123");
  assert.equal(payload?.tokenType, "access");
});

