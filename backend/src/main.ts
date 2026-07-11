import dotenv from "dotenv";
import { existsSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadAppEnv } from "./config/env.js";
import { startBackendServer } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

for (const envFile of [
  resolve(__dirname, "../../.env"),
  resolve(__dirname, "../../.env.local"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../.env.local"),
]) {
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

async function main() {
  const env = loadAppEnv();

  try {
    const alreadyRunning = await isBackendAlreadyRunning(env.PORT);
    if (alreadyRunning) {
      console.error(
        JSON.stringify({
          level: "info",
          message: `INHERIX backend is already running on port ${env.PORT}. Reusing the existing instance.`,
          timestamp: new Date().toISOString(),
          port: env.PORT,
        })
      );
      return;
    }

    await startBackendServer(env);
  } catch (error) {
    const isPortBusy = error instanceof Error && "code" in error && (error as { code?: string }).code === "EADDRINUSE";
    console.error(
      JSON.stringify({
        level: "error",
        message: isPortBusy
          ? `Port ${env.PORT} is already in use. Stop the existing backend or set PORT to another free value before starting again.`
          : "Failed to start INHERIX backend",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
    );
    process.exitCode = 1;
  }
}

void main();

function isBackendAlreadyRunning(port: number) {
  return new Promise<boolean>((resolve) => {
    const request = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/v1/ready",
        timeout: 1000,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200 || response.statusCode === 503);
      }
    );

    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}
