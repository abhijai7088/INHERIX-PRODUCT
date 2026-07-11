import type { Metadata } from "next";

import AcceptInvitationClient from "./accept-invitation-client";

export const metadata: Metadata = {
  title: "INHERIX | Accept Invitation",
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return <AcceptInvitationClient token={params.token ?? ""} />;
}
