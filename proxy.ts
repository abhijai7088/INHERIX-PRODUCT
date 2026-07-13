import { NextRequest, NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/backend-api";
import { getAuthenticatedLandingPath, getRouteAccessDecision } from "@/lib/route-access";

const publicOnboardingRoutes = new Set([
  "/onboarding/splash",
  "/onboarding/welcome",
  "/onboarding/create-account",
  "/onboarding/login",
  "/onboarding/forgot-password",
  "/onboarding/reset-password",
  "/onboarding/force-reset-password",
  "/onboarding/verify-email",
  "/onboarding/accept-invitation",
]);

const backendSessionTimeoutMs = 2500;
const restrictedDashboardPrefixes = [
  "/dashboard/verification",
  "/dashboard/emergency/verification",
  "/dashboard/releases/history",
  "/dashboard/releases",
  "/dashboard/released-documents",
  "/dashboard/admin",
  "/dashboard/security",
  "/dashboard/governance",
  "/dashboard/audit",
  "/dashboard/backup",
  "/dashboard/logs",
  "/dashboard/reports",
  "/dashboard/settings",
];

function matchesDashboardPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function applyRedirect(target: URL, redirectTo: string) {
  const baseUrl = process.env.FRONTEND_ORIGIN || target.origin;
  const redirectUrl = new URL(redirectTo, baseUrl);
  target.protocol = redirectUrl.protocol;
  target.host = redirectUrl.host;
  target.port = redirectUrl.port;
  target.pathname = redirectUrl.pathname;
  target.search = redirectUrl.search;
  target.hash = redirectUrl.hash;
}

async function resolveBackendSession(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const frontendAccessToken = request.cookies.get("inherix_access_token")?.value ?? null;

  if (!cookieHeader && !frontendAccessToken) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), backendSessionTimeoutMs);

  try {
    const response = await fetch(buildBackendUrl("/auth/me"), {
      headers: frontendAccessToken
        ? {
            authorization: `Bearer ${frontendAccessToken}`,
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          }
        : {
            cookie: cookieHeader ?? "",
          },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return response.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasFrontendAccessToken = Boolean(request.cookies.get("inherix_access_token")?.value);

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/onboarding")) {
    return NextResponse.next();
  }

  const session = await resolveBackendSession(request);
  const user = session?.data?.user ?? null;

  if (pathname.startsWith("/dashboard")) {
    if (!user && hasFrontendAccessToken) {
      const restrictedRoute = restrictedDashboardPrefixes.find((candidate) => matchesDashboardPrefix(pathname, candidate));

      if (restrictedRoute) {
        const url = request.nextUrl.clone();
        applyRedirect(url, "/dashboard");
        return NextResponse.redirect(url);
      }

      return NextResponse.next();
    }

    const decision = getRouteAccessDecision(session, pathname);

    if (!decision.allow) {
      const url = request.nextUrl.clone();
      applyRedirect(url, decision.redirectTo ?? "/dashboard");
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (publicOnboardingRoutes.has(pathname)) {
    const hasVerificationToken = pathname === "/onboarding/verify-email" && request.nextUrl.searchParams.has("token");
    const hasInvitationToken = pathname === "/onboarding/accept-invitation" && request.nextUrl.searchParams.has("token");
    const isForceResetPath = pathname === "/onboarding/force-reset-password";

    if (hasVerificationToken || hasInvitationToken) {
      return NextResponse.next();
    }

    if (isForceResetPath) {
      if (user?.mustResetPassword) {
        return NextResponse.next();
      }

      if (user) {
        const url = request.nextUrl.clone();
        applyRedirect(url, getAuthenticatedLandingPath(session));
        return NextResponse.redirect(url);
      }

      return NextResponse.next();
    }

    if (
      user &&
      !(pathname === "/onboarding/verify-email" && !user.isEmailVerified) &&
      pathname !== "/onboarding/accept-invitation"
    ) {
      const url = request.nextUrl.clone();
      applyRedirect(url, getAuthenticatedLandingPath(session));
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (user) {
    const url = request.nextUrl.clone();
    applyRedirect(url, getAuthenticatedLandingPath(session));
    return NextResponse.redirect(url);
  }

  const url = request.nextUrl.clone();
  applyRedirect(url, "/onboarding/splash");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
