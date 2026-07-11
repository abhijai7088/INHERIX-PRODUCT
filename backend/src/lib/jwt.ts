import crypto from "node:crypto";

import { base64UrlDecode, base64UrlEncode, timingSafeEqual } from "./crypto.js";

export type JwtPayload = Record<string, string | number | boolean | null | undefined> & {
  sub?: string;
  tokenType?: "access" | "refresh";
  sessionId?: string;
};

function createSigningInput(header: unknown, payload: JwtPayload) {
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
}

export function signJwt(
  payload: JwtPayload,
  secret: string,
  expiresInMs: number
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jwtPayload: JwtPayload & { iat: number; exp: number; jti: string } = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + Math.floor(expiresInMs / 1000),
    jti: crypto.randomUUID(),
  };

  const signingInput = createSigningInput({ alg: "HS256", typ: "JWT" }, jwtPayload);
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export function verifyJwt<T extends JwtPayload>(
  token: string,
  secret: string
) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const providedSignature = base64UrlDecode(signaturePart);

  if (!timingSafeEqual(expectedSignature.toString("hex"), providedSignature.toString("hex"))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart).toString("utf8")) as T & {
      exp?: number;
    };

    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

