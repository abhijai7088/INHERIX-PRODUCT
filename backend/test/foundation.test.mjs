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

async function withServer(run) {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger);

  await new Promise((resolve) => server.listen(0, resolve));

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("backend foundation exposes health, readiness, docs, and echo routes", async () => {
  await withServer(async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(healthResponse.status, 200);

    const healthJson = await healthResponse.json();
    assert.equal(healthJson.success, true);
    assert.equal(healthJson.data.status, "ok");

    const readyResponse = await fetch(`${baseUrl}/api/v1/ready`);
    assert.equal(readyResponse.status, 200);

    const readyJson = await readyResponse.json();
    assert.equal(readyJson.success, true);
    assert.equal(readyJson.data.status, "ready");

    const metaResponse = await fetch(`${baseUrl}/api/v1/meta`);
    assert.equal(metaResponse.status, 200);

    const metaJson = await metaResponse.json();
    assert.equal(metaJson.success, true);
    assert.equal(metaJson.data.name, "INHERIX Backend");
    assert.equal(metaJson.data.version, "0.1.0");

    const docsResponse = await fetch(`${baseUrl}/api/v1/docs`);
    assert.equal(docsResponse.status, 200);

    const docsJson = await docsResponse.json();
    assert.equal(docsJson.openapi, "3.1.0");

    const echoResponse = await fetch(`${baseUrl}/api/v1/echo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hello: "inherix" }),
    });

    assert.equal(echoResponse.status, 200);

    const echoJson = await echoResponse.json();
    assert.equal(echoJson.success, true);
    assert.deepEqual(echoJson.data.body, { hello: "inherix" });

    const notFoundResponse = await fetch(`${baseUrl}/api/v1/unknown`);
    assert.equal(notFoundResponse.status, 404);

    const notFoundJson = await notFoundResponse.json();
    assert.equal(notFoundJson.success, false);
    assert.equal(notFoundJson.errorCode, "NOT_FOUND");
  });
});
