import { NextRequest, NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/backend-api";

export async function POST(request: NextRequest) {
  const response = await fetch(buildBackendUrl("/auth/logout"), {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });

  const payload = await response.text();
  const nextResponse = new NextResponse(payload, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
    },
  });

  const setCookies = response.headers.getSetCookie();
  for (const cookie of setCookies) {
    nextResponse.headers.append("Set-Cookie", cookie);
  }

  return nextResponse;
}
