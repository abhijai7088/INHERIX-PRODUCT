const accessTokenCookieName = "inherix_access_token";

let accessToken: string | null = readStoredAccessToken();

function readStoredAccessToken() {
  const cookieToken = readCookieAccessToken();
  if (cookieToken) {
    persistAccessToken(cookieToken);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("inherix_access_token");
      } catch {
        // Ignore storage cleanup failures and continue with the cookie-backed session.
      }
    }

    return cookieToken;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    window.localStorage.removeItem("inherix_access_token");
  } catch {
    // Ignore storage cleanup failures and fall back to the in-memory token.
  }

  return null;
}

function readCookieAccessToken() {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${accessTokenCookieName}=`));

  if (!match) {
    return null;
  }

  const rawValue = match.slice(accessTokenCookieName.length + 1);

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue || null;
  }
}

function persistAccessToken(token: string | null) {
  if (typeof document === "undefined") {
    return;
  }

  try {
    const secureFlag = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";

    if (token) {
      document.cookie = `${accessTokenCookieName}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secureFlag}`;
    } else {
      document.cookie = `${accessTokenCookieName}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`;
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("inherix_access_token");
      } catch {
        // Ignore storage cleanup failures and continue with the cookie-backed session.
      }
    }
  } catch {
    // Ignore storage failures and continue with in-memory auth state.
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  persistAccessToken(token);
}

export function getAccessToken() {
  if (!accessToken) {
    accessToken = readStoredAccessToken();
  }

  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
  persistAccessToken(null);
}

export async function backendJsonFetch(path: string, init: RequestInit = {}) {
  const { buildBackendUrl } = await import("./backend-api");
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(buildBackendUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
}

export async function backendBinaryFetch(path: string, init: RequestInit = {}) {
  const { buildBackendUrl } = await import("./backend-api");
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(buildBackendUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
}
