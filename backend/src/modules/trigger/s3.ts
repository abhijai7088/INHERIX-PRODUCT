import { randomUUID } from "node:crypto";

import type { AppEnv } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";
import { createS3Signer, type S3Signer } from "../vault/s3.js";

export function buildTriggerProofStorageKey(customerId: string, requestId: string, proofId: string, fileName: string | null) {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  const suffix = extension ? `.${extension}` : ".enc";
  return `customers/${customerId}/trigger-requests/${requestId}/proofs/${proofId}${suffix}`;
}

export function createTriggerProofEncryptionKeyRef(proofId: string) {
  return `kms:${randomUUID()}:${proofId}`;
}

export function createTriggerProofSigner(env: AppEnv, overrides?: Parameters<typeof createS3Signer>[1]): S3Signer {
  if (env.NODE_ENV !== "production") {
    const baseUrl = env.API_BASE_URL ?? `http://localhost:${env.PORT}${env.API_PREFIX.startsWith("/") ? env.API_PREFIX : `/${env.API_PREFIX}`}`;
    const localUploadsBase = `${baseUrl.replace(/\/+$/, "")}/dev/uploads/trigger-proofs`;

    return {
      signPutObject(key, contentType) {
        const requiredHeaders: Record<string, string> = {};
        if (contentType) {
          requiredHeaders["content-type"] = contentType;
        }

        return {
          url: `${localUploadsBase}/${encodeURIComponent(key)}`,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          requiredHeaders,
        };
      },
      signGetObject(key, fileName, disposition: "inline" | "attachment" = "inline") {
        const query = fileName ? `?fileName=${encodeURIComponent(fileName)}` : "";
        return {
          url: `${localUploadsBase}/${encodeURIComponent(key)}${query}`,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          requiredHeaders: {},
        };
      },
      async signDeleteObject(key) {
        await fetch(`${localUploadsBase}/${encodeURIComponent(key)}`, { method: "DELETE" });
      },
    };
  }

  if (!env.S3_BUCKET_NAME || !env.AWS_REGION || !env.AWS_KMS_KEY_ID) {
    throw new HttpError(
      503,
      "S3_CONFIGURATION_REQUIRED",
      "S3_BUCKET_NAME, AWS_REGION, and AWS_KMS_KEY_ID are required for trigger proof uploads."
    );
  }

  return createS3Signer(env, overrides);
}
