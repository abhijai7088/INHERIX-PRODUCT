const fallbackBaseUrl = "http://localhost:8080/api/v1";

export class BackendApiError extends Error {
  statusCode: number;
  errorCode: string | null;

  constructor(message: string, statusCode: number, errorCode: string | null = null) {
    super(message);
    this.name = "BackendApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export function getBackendApiBaseUrl() {
  if (typeof window === "undefined" && process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/+$/, "");
  }
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? fallbackBaseUrl).replace(/\/+$/, "");
}

export function buildBackendUrl(path: string) {
  const baseUrl = getBackendApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export async function parseBackendJsonResponse<T>(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new BackendApiError(payload?.message ?? fallbackMessage, response.status, payload?.errorCode ?? null);
  }

  if (!payload) {
    throw new BackendApiError(fallbackMessage, response.status, null);
  }

  return (payload?.data ?? payload) as T;
}

export function isBackendApiError(error: unknown): error is BackendApiError {
  return error instanceof BackendApiError;
}
