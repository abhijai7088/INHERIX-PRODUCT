import type { Metadata } from "next";

import ResetPasswordClient from "./reset-password-client";

export const metadata: Metadata = {
  title: "INHERIX | Reset Password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return <ResetPasswordClient token={params.token ?? ""} />;
}
