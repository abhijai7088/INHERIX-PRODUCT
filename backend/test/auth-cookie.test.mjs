import assert from "node:assert/strict";
import { test } from "node:test";

import { serializeBrowserSessionCookie, serializeRefreshCookie } from "../dist/modules/auth/auth.routes.js";

const testEnv = {
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
};

test("refresh cookie is scoped to the browser session", () => {
  const cookie = serializeRefreshCookie("refresh-token-value", testEnv);

  assert.ok(cookie.includes("inherix_refresh_token=refresh-token-value"));
  assert.ok(cookie.includes("Path=/"));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=lax"));
  assert.ok(!cookie.includes("Max-Age="));
  assert.ok(!cookie.includes("Expires="));
});

test("browser session cookie is scoped to the browser session", () => {
  const cookie = serializeBrowserSessionCookie(testEnv);

  assert.ok(cookie.includes("inherix_browser_session=1"));
  assert.ok(cookie.includes("Path=/"));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=lax"));
  assert.ok(!cookie.includes("Max-Age="));
  assert.ok(!cookie.includes("Expires="));
});
