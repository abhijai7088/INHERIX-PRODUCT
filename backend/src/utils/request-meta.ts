import type { IncomingMessage } from "node:http";

export function getRequestIp(request: IncomingMessage) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.split(",")[0]?.trim() ?? request.socket.remoteAddress ?? null;
  }

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? request.socket.remoteAddress ?? null;
  }

  return request.socket.remoteAddress ?? null;
}

export function getUserAgent(request: IncomingMessage) {
  const userAgent = request.headers["user-agent"];

  if (Array.isArray(userAgent)) {
    return userAgent[0] ?? null;
  }

  return userAgent ?? null;
}

export function parseClientInfo(userAgent: string | null) {
  if (!userAgent) {
    return {
      browserInfo: null,
      deviceInfo: null,
    };
  }

  const browserInfo =
    userAgent.includes("Edg/")
      ? "Microsoft Edge"
      : userAgent.includes("Chrome/")
        ? "Chrome"
        : userAgent.includes("Firefox/")
          ? "Firefox"
          : userAgent.includes("Safari/")
            ? "Safari"
            : "Unknown browser";

  const deviceInfo =
    /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent) ? "Mobile device" : "Desktop device";

  return { browserInfo, deviceInfo };
}

export function getLocationInfo(request: IncomingMessage) {
  const location =
    request.headers["x-location-info"] ??
    request.headers["x-verification-location"] ??
    request.headers["x-forwarded-city"] ??
    null;

  if (Array.isArray(location)) {
    return location[0] ?? null;
  }

  return location ? String(location) : null;
}

