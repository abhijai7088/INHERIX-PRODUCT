import { BackendApiError } from "./backend-api";

export function isAuthenticationError(error: unknown) {
  return (
    error instanceof BackendApiError &&
    (error.statusCode === 401 ||
      error.errorCode === "UNAUTHORIZED" ||
      /authentication is required/i.test(error.message))
  );
}

export function isMissingS3CredentialsError(error: unknown) {
  return (
    error instanceof BackendApiError &&
    (error.statusCode === 503 ||
      error.errorCode === "S3_CREDENTIALS_REQUIRED" ||
      /AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required/i.test(error.message))
  );
}

export function isMissingS3ConfigError(error: unknown) {
  return (
    error instanceof BackendApiError &&
    (error.statusCode === 503 ||
      error.errorCode === "S3_CONFIGURATION_REQUIRED" ||
      /S3_BUCKET_NAME, AWS_REGION, and AWS_KMS_KEY_ID are required/i.test(error.message))
  );
}

export function isDatabaseUnavailableError(error: unknown) {
  return (
    error instanceof BackendApiError &&
    (error.statusCode === 503 ||
      error.errorCode === "DATABASE_UNAVAILABLE" ||
      /database connection is unavailable/i.test(error.message) ||
      /couldn't reach .*localhost/i.test(error.message))
  );
}

export function isGenericBackendError(error: unknown) {
  return error instanceof BackendApiError && error.statusCode >= 500;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
