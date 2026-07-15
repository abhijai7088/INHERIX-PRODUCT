import { z } from "zod";

export const backendEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  API_PREFIX: z.string().default("/api/v1"),
  API_BASE_URL: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  FRONTEND_ORIGIN: z.string().optional(),
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  TRUST_PROXY: z.coerce.boolean().default(true),
  REQUEST_BODY_LIMIT: z.string().default("1mb"),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),
  AUTH_COOKIE_NAME: z.string().default("inherix_refresh_token"),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_COOKIE_SECURE: z.coerce.boolean().default(false),
  AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  S3_BUCKET_NAME: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_KMS_KEY_ID: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  DEV_LOCAL_UPLOADS_DIR: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["development", "gmail", "sendgrid", "ses"]).default("development"),
  EMAIL_FROM: z.string().optional(),
  EMAIL_GMAIL_USER: z.string().optional(),
  EMAIL_GMAIL_APP_PASSWORD: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  AWS_SES_REGION: z.string().optional(),
});

export type AppEnv = z.infer<typeof backendEnvSchema>;

export const productionSecretNames = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "S3_BUCKET_NAME",
  "AWS_REGION",
  "AWS_KMS_KEY_ID",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

export function loadAppEnv(rawEnv: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = backendEnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid backend environment: ${issue?.path.join(".") ?? "env"} ${issue?.message ?? "is invalid"}.`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    const missing = getMissingProductionSecrets(env);

    if (missing.length) {
      throw new Error(
        `Missing production secrets: ${missing.join(", ")}. Provide them before starting the backend in production.`
      );
    }


    if (env.EMAIL_PROVIDER === "development") {
      throw new Error("EMAIL_PROVIDER must be set to gmail, sendgrid, or ses in production.");
    }
  }

  return env;
}

export function getMissingProductionSecrets(env: AppEnv) {
  const missing: string[] = [];

  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!env.JWT_REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");
  if (!env.S3_BUCKET_NAME) missing.push("S3_BUCKET_NAME");
  if (!env.AWS_REGION) missing.push("AWS_REGION");
  if (!env.AWS_KMS_KEY_ID) missing.push("AWS_KMS_KEY_ID");
  if (!env.AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!env.AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!env.FRONTEND_ORIGIN) missing.push("FRONTEND_ORIGIN");
  if (!env.EMAIL_PROVIDER) missing.push("EMAIL_PROVIDER");
  if (env.EMAIL_PROVIDER !== "development" && env.EMAIL_PROVIDER !== "gmail" && !env.EMAIL_FROM) missing.push("EMAIL_FROM");

  if (env.EMAIL_PROVIDER === "gmail") {
    if (!env.EMAIL_GMAIL_USER) missing.push("EMAIL_GMAIL_USER");
    if (!env.EMAIL_GMAIL_APP_PASSWORD) missing.push("EMAIL_GMAIL_APP_PASSWORD");
  }

  if (env.EMAIL_PROVIDER === "sendgrid" && !env.SENDGRID_API_KEY) {
    missing.push("SENDGRID_API_KEY");
  }

  if (env.EMAIL_PROVIDER === "ses" && !env.AWS_SES_REGION) {
    missing.push("AWS_SES_REGION");
  }

  return missing;
}

export function hasEmailDeliveryConfig(env: AppEnv) {
  if (env.EMAIL_PROVIDER === "gmail") {
    return Boolean(env.EMAIL_GMAIL_USER && env.EMAIL_GMAIL_APP_PASSWORD);
  }

  if (env.EMAIL_PROVIDER === "sendgrid") {
    return Boolean(env.EMAIL_FROM && env.SENDGRID_API_KEY);
  }

  if (env.EMAIL_PROVIDER === "ses") {
    return Boolean(env.EMAIL_FROM && env.AWS_SES_REGION);
  }

  return Boolean(env.EMAIL_FROM);
}

export function getApiBaseUrl(env: AppEnv) {
  if (env.API_BASE_URL) {
    return env.API_BASE_URL.replace(/\/+$/, "");
  }

  return `http://localhost:${env.PORT}${normalizePrefix(env.API_PREFIX)}`;
}

function normalizePrefix(prefix: string) {
  if (!prefix.startsWith("/")) {
    return `/${prefix}`;
  }

  return prefix === "/" ? "" : prefix.replace(/\/+$/, "");
}
