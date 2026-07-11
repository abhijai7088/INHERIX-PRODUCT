import { createHmac, randomUUID } from "node:crypto";

import type { AppEnv } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";
import { sha256Hex } from "../../lib/crypto.js";
import type { S3SignedUrl } from "./types.js";

export type S3Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | null;
};

export type S3Signer = {
  signPutObject(key: string, contentType: string | null): S3SignedUrl;
  signGetObject(key: string, fileName: string | null, disposition?: "inline" | "attachment"): S3SignedUrl;
  signDeleteObject(key: string): Promise<void>;
};

function toAmzDate(date: Date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: `${iso.slice(0, 8)}T${iso.slice(9, 15)}Z`,
    dateStamp: iso.slice(0, 8),
  };
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalizePath(key: string) {
  const encodedSegments = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeRfc3986(segment));

  return `/${encodedSegments.join("/")}`;
}

function canonicalizeQuery(params: URLSearchParams) {
  return [...params.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      }
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    })
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

function hmac(key: Buffer | string, value: string, digest?: "hex"): string;
function hmac(key: Buffer | string, value: string, digest: "buffer"): Buffer;
function hmac(key: Buffer | string, value: string, digest: "hex" | "buffer" = "hex"): string | Buffer {
  const result = createHmac("sha256", key).update(value, "utf8").digest();
  return digest === "hex" ? result.toString("hex") : result;
}

function deriveSigningKey(secretAccessKey: string, dateStamp: string, region: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp, "buffer");
  const kRegion = hmac(kDate, region, "buffer");
  const kService = hmac(kRegion, "s3", "buffer");
  return hmac(kService, "aws4_request", "buffer");
}

function buildHost(bucket: string, region: string) {
  return `${bucket}.s3.${region}.amazonaws.com`;
}

function buildResponseContentDisposition(fileName: string | null, disposition: "inline" | "attachment" = "inline") {
  if (!fileName) {
    return null;
  }

  return `${disposition}; filename="${fileName.replaceAll("\"", "")}"`;
}

export function getS3Credentials(env: AppEnv, overrides?: Partial<S3Credentials>) {
  const accessKeyId = overrides?.accessKeyId ?? env.AWS_ACCESS_KEY_ID ?? "";
  const secretAccessKey = overrides?.secretAccessKey ?? env.AWS_SECRET_ACCESS_KEY ?? "";
  const sessionToken = overrides?.sessionToken ?? env.AWS_SESSION_TOKEN ?? null;

  if (!accessKeyId || !secretAccessKey) {
    throw new HttpError(
      503,
      "S3_CREDENTIALS_REQUIRED",
      "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required to generate signed S3 URLs."
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
  };
}

export function createS3Signer(
  env: AppEnv,
  credentialsOverrides?: Partial<S3Credentials>
): S3Signer {
  if (!env.S3_BUCKET_NAME || !env.AWS_REGION || !env.AWS_KMS_KEY_ID) {
    throw new HttpError(
      503,
      "S3_CONFIGURATION_REQUIRED",
      "S3_BUCKET_NAME, AWS_REGION, and AWS_KMS_KEY_ID are required for document storage."
    );
  }

  const credentials = getS3Credentials(env, credentialsOverrides);
  const bucket = env.S3_BUCKET_NAME;
  const region = env.AWS_REGION;
  const kmsKeyId = env.AWS_KMS_KEY_ID;
  const host = buildHost(bucket, region);

  function buildSignedUrl(
    method: "PUT" | "GET" | "DELETE",
    key: string,
    expiresInSeconds: number,
    extraHeaders: Record<string, string> = {},
    extraQuery: Record<string, string | null | undefined> = {}
  ): S3SignedUrl {
    const { amzDate, dateStamp } = toAmzDate(new Date());
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${credentials.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresInSeconds),
      "X-Amz-SignedHeaders": ["host", ...Object.keys(extraHeaders).map((name) => name.toLowerCase())].join(";"),
      ...Object.fromEntries(
        Object.entries(extraQuery).flatMap(([keyName, value]) => (value ? [[keyName, value]] : []))
      ),
    });

    if (credentials.sessionToken) {
      query.set("X-Amz-Security-Token", credentials.sessionToken);
    }

    const canonicalHeaders = {
      host,
      ...Object.fromEntries(Object.entries(extraHeaders).map(([name, value]) => [name.toLowerCase(), value.trim()])),
    };

    const canonicalHeaderString = Object.entries(canonicalHeaders)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}:${value}\n`)
      .join("");

    const signedHeaders = Object.keys(canonicalHeaders).sort().join(";");
    query.set("X-Amz-SignedHeaders", signedHeaders);

    const canonicalRequest = [
      method,
      canonicalizePath(key),
      canonicalizeQuery(query),
      canonicalHeaderString,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = deriveSigningKey(credentials.secretAccessKey, dateStamp, region);
    const signature = hmac(signingKey, stringToSign);
    query.set("X-Amz-Signature", signature);

    return {
      url: `https://${host}${canonicalizePath(key)}?${canonicalizeQuery(query)}`,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      requiredHeaders: extraHeaders,
    };
  }

  return {
    signPutObject(key, contentType) {
      return buildSignedUrl(
        "PUT",
        key,
        15 * 60,
        {
          "x-amz-server-side-encryption": "aws:kms",
          "x-amz-server-side-encryption-aws-kms-key-id": kmsKeyId,
          ...(contentType ? { "content-type": contentType } : {}),
        }
      );
    },
    signGetObject(key, fileName, disposition: "inline" | "attachment" = "inline") {
      return buildSignedUrl(
        "GET",
        key,
        10 * 60,
        {},
        fileName ? { "response-content-disposition": buildResponseContentDisposition(fileName, disposition) } : {}
      );
    },
    async signDeleteObject(key) {
      const ticket = buildSignedUrl("DELETE", key, 5 * 60);
      const response = await fetch(ticket.url, { method: "DELETE" });

      if (!response.ok && response.status !== 404) {
        throw new HttpError(502, "S3_DELETE_FAILED", "The document object could not be deleted from S3.");
      }
    },
  };
}

export function buildDocumentStorageKey(customerId: string, vaultId: string, categoryId: string, documentId: string, fileName: string | null) {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  const suffix = extension ? `.${extension}` : ".enc";
  return `customers/${customerId}/vaults/${vaultId}/categories/${categoryId}/documents/${documentId}${suffix}`;
}

export function createDocumentEncryptionKeyRef(documentId: string) {
  return `kms:${randomUUID()}:${documentId}`;
}
