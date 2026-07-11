import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";

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
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

test("profile API contract is published in OpenAPI", async () => {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger, {});

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/docs`);
    assert.equal(response.status, 200);

    const docs = await response.json();
    assert.equal(docs.openapi, "3.1.0");

    for (const path of [
      "/profile",
      "/profile/account",
      "/profile/notifications",
      "/profile/privacy",
      "/profile/privacy/export",
      "/profile/privacy/deletion-request",
      "/profile/security/change-password",
      "/profile/security/mfa/enable",
      "/profile/security/mfa/disable",
      "/profile/security/sessions",
      "/profile/security/sessions/{sessionId}",
      "/profile/security/sessions/revoke-all",
      "/profile/security/recovery-codes/rotate",
      "/profile/security/trusted-devices/{sessionId}/trust",
      "/profile/security/alerts/{eventId}/acknowledge",
    ]) {
      assert.ok(docs.paths[path], `Expected ${path} in OpenAPI paths.`);
    }

    assert.ok(docs.components.schemas.ProfileSnapshotResponse, "ProfileSnapshotResponse schema is missing.");
    assert.ok(docs.components.schemas.ProfileSnapshot, "ProfileSnapshot schema is missing.");
    assert.ok(docs.components.schemas.ProfileAccountUpdateRequest, "ProfileAccountUpdateRequest schema is missing.");
    assert.ok(docs.components.schemas.ProfileNotificationPreferencesRequest, "ProfileNotificationPreferencesRequest schema is missing.");
    assert.ok(docs.components.schemas.ProfilePrivacyPreferencesRequest, "ProfilePrivacyPreferencesRequest schema is missing.");
    assert.ok(docs.components.schemas.ProfilePrivacyExportRequest, "ProfilePrivacyExportRequest schema is missing.");
    assert.ok(docs.components.schemas.ProfilePrivacyDeletionRequest, "ProfilePrivacyDeletionRequest schema is missing.");
    assert.ok(docs.components.schemas.ProfilePrivacyRequest, "ProfilePrivacyRequest schema is missing.");
    assert.ok(docs.components.schemas.ProfilePrivacyWorkflowResponse, "ProfilePrivacyWorkflowResponse schema is missing.");
    assert.ok(docs.components.schemas.ProfileHardeningSummary, "ProfileHardeningSummary schema is missing.");
    assert.ok(docs.components.schemas.ProfileRecoveryCodeSummary, "ProfileRecoveryCodeSummary schema is missing.");
    assert.ok(docs.components.schemas.ProfileTrustedDevice, "ProfileTrustedDevice schema is missing.");
    assert.ok(docs.components.schemas.ProfileSecurityAlert, "ProfileSecurityAlert schema is missing.");
    assert.ok(docs.components.schemas.ProfileRecoveryCodeRotationResponse, "ProfileRecoveryCodeRotationResponse schema is missing.");
    assert.ok(Array.isArray(docs.components.schemas.ProfileSnapshot.properties.notifications.properties.lastReviewedAt.type));
    assert.ok(docs.components.schemas.ProfileSnapshot.properties.privacy.properties.requests, "Profile privacy requests are missing from the snapshot schema.");
    assert.equal(docs.components.schemas.ProfileSnapshot.properties.notifications.properties.preferences.properties.emailEnabled.type, "boolean");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
