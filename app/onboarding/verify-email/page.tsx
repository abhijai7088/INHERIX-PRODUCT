import type { Metadata } from "next";

import VerifyEmailClient from "./verify-email-client";

export const metadata: Metadata = {
  title: "INHERIX | Verify Email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; email?: string; next?: string }>;
}) {
  const params = searchParams ? await searchParams : {};

  return (
    <VerifyEmailClient
      token={params.token ?? ""}
      email={params.email ?? ""}
      nextPath={params.next ?? ""}
    />
  );
}
