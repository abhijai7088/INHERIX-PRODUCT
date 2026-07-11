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

test("trigger document-request API contract is published in OpenAPI", async () => {
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

    assert.ok(docs.paths["/trigger-requests/document-access/eligible-documents"], "Eligible documents endpoint is missing.");
    assert.ok(docs.paths["/trigger-requests"], "Trigger request collection endpoint is missing.");
    assert.ok(docs.paths["/trigger-requests/{requestId}/document/preview"], "Requested document preview endpoint is missing.");

    const triggerRequest = docs.components.schemas.TriggerRequestRecord;
    assert.ok(triggerRequest.properties.documentId, "TriggerRequestRecord.documentId is missing.");
    assert.ok(triggerRequest.properties.documentTitle, "TriggerRequestRecord.documentTitle is missing.");
    assert.ok(
      triggerRequest.properties.requestKind.enum.includes("document-access"),
      "TriggerRequestRecord.requestKind should include document-access."
    );

    const createRequest = docs.components.schemas.TriggerRequestCreateRequest;
    assert.ok(createRequest.properties.documentId, "TriggerRequestCreateRequest.documentId is missing.");
    assert.ok(
      createRequest.properties.requestKind.enum.includes("document-access"),
      "TriggerRequestCreateRequest.requestKind should include document-access."
    );

    assert.ok(
      docs.components.schemas.TriggerEligibleDocumentRecord,
      "TriggerEligibleDocumentRecord schema is missing."
    );
    assert.ok(
      docs.components.schemas.TriggerEligibleDocumentListResponse,
      "TriggerEligibleDocumentListResponse schema is missing."
    );
    assert.ok(
      docs.components.schemas.TriggerDocumentPreviewResponse,
      "TriggerDocumentPreviewResponse schema is missing."
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
