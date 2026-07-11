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

test("auth API contract is published in OpenAPI", async () => {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger);

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

    for (const path of ["/auth/login", "/auth/refresh-token", "/auth/me", "/auth/logout"]) {
      assert.ok(docs.paths[path], `Expected ${path} in OpenAPI paths.`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
