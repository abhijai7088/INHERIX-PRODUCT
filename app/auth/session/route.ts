import { NextRequest, NextResponse } from "next/server";

const accessTokenCookieName = "inherix_access_token";
const browserSessionCookieName = "inherix_browser_session";

function resolveSafeNextPath(request: NextRequest, candidate: string | null) {
  if (!candidate) {
    return "/dashboard";
  }

  if (!candidate.startsWith("/")) {
    return "/dashboard";
  }

  if (candidate.startsWith("//")) {
    return "/dashboard";
  }

  return candidate;
}

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const nextPath = resolveSafeNextPath(request, request.nextUrl.searchParams.get("next"));

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const baseUrl = process.env.FRONTEND_ORIGIN || request.nextUrl.origin;
  const url = new URL(nextPath, baseUrl);

  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: accessTokenCookieName,
    value: token,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
  });
  response.cookies.set({
    name: browserSessionCookieName,
    value: "1",
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  response.headers.set("Cache-Control", "no-store");

  return response;
}
