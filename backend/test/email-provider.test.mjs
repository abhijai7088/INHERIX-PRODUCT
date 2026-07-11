import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createEmailService } from "../dist/modules/email/email.service.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: 0,
  API_PREFIX: "/api/v1",
  API_BASE_URL: "http://127.0.0.1:0/api/v1",
  LOG_LEVEL: "silent",
  FRONTEND_ORIGIN: "http://localhost:3000",
  SWAGGER_ENABLED: true,
  TRUST_PROXY: false,
  REQUEST_BODY_LIMIT: "1mb",
  DATABASE_URL: undefined,
  JWT_ACCESS_SECRET: undefined,
  JWT_REFRESH_SECRET: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  S3_BUCKET_NAME: undefined,
  AWS_REGION: undefined,
  AWS_KMS_KEY_ID: undefined,
  AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
  AWS_SECRET_ACCESS_KEY: "example-secret",
  AWS_SESSION_TOKEN: "example-session-token",
  EMAIL_PROVIDER: "ses",
  EMAIL_FROM: "no-reply@inherix.example",
  EMAIL_GMAIL_USER: undefined,
  EMAIL_GMAIL_APP_PASSWORD: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: "us-east-1",
};

test("SES email delivery signs and sends verification messages", async () => {
  const logger = createLogger("silent");
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];

  globalThis.fetch = async (input, init) => {
    fetchCalls.push({
      input: String(input),
      init: init
        ? {
            ...init,
            headers: new Headers(init.headers),
          }
        : null,
    });

    return new Response("", { status: 200, statusText: "OK" });
  };

  try {
    const emailService = createEmailService(testEnv, logger);
    await emailService.sendVerificationEmail("recipient@example.com", "verification-token", "Ada Lovelace");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls.length, 1);
  const call = fetchCalls[0];
  assert.ok(call);
  assert.equal(call.input, "https://email.us-east-1.amazonaws.com/v2/email/outbound-emails");

  const headers = call.init?.headers;
  assert.ok(headers instanceof Headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("x-amz-security-token"), "example-session-token");
  assert.equal(headers.get("x-amz-date")?.length, 16);
  assert.ok(headers.get("authorization")?.startsWith("AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/"));

  const payload = JSON.parse(String(call.init?.body ?? "{}"));
  assert.equal(payload.FromEmailAddress, "no-reply@inherix.example");
  assert.equal(payload.Destination.ToAddresses[0], "recipient@example.com");
  assert.equal(payload.Content.Simple.Subject.Data, "Verify your INHERIX email address");
  assert.ok(String(payload.Content.Simple.Body.Text.Data).includes("verification-token"));
  assert.ok(String(payload.Content.Simple.Body.Text.Data).includes("http://localhost:3000/onboarding/verify-email"));
});
