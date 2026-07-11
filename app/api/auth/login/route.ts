import { NextRequest, NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/backend-api";

export async function POST(request: NextRequest) {
  const response = await fetch(buildBackendUrl("/auth/login"), {
    method: "POST",
    headers: {
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

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    nextResponse.headers.set("Set-Cookie", setCookie);
  }

  return nextResponse;
}
