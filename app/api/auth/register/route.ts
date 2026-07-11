import { NextRequest, NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/backend-api";

export async function POST(request: NextRequest) {
  const response = await fetch(buildBackendUrl("/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });

  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
    },
  });
}
