"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { Textarea } from "@/components/inherix/textarea";
import { formatRelationship, relationshipOptions } from "@/lib/records";
import { createNominee, loadNominees, type NomineeApiRecord } from "@/lib/nominees";

export default function InviteConnectionPage() {
  const router = useRouter();
  const authHelpText = "Sign in to invite a connection.";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nominees, setNominees] = useState<NomineeApiRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const payload = await loadNominees();
        setNominees(payload.nominees);
      } catch (loadError) {
        setError(isAuthenticationError(loadError) ? authHelpText : getErrorMessage(loadError, "Unable to load nominees."));
      }
    };

    void load();
  }, []);

  const recentNominees = useMemo(() => nominees.slice(0, 3), [nominees]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!relationship) {
      setError("Choose a relationship.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = await createNominee({
        fullName,
        email,
        mobile,
        relationship,
        customRelationship: customRelationship.trim() || null,
        notes: notes.trim() || null,
      });

      router.push(`/dashboard/family/${payload.nominee.id}`);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to send the invitation right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#163B8C]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="default">Invite Connection</Badge>
            <Badge variant="secondary">Audit logged</Badge>
          </div>

          <h1 className="mt-4 text-[30px] font-semibold tracking-tight text-[#0F172A] md:text-[36px]">
            Invite Connection
          </h1>

          <p className="mt-2 text-sm text-slate-500 md:text-base">
            Invite trusted people and assign secure continuity access.
          </p>
        </div>
      </div>

      <div className="rounded-[32px] border border-[#DCE3EC] bg-white p-5 md:p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F172A]">Email Address</label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter email address" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F172A]">Full Name</label>
              <Input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter full name" />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F172A]">Relationship</label>
              <select value={relationship} onChange={(event) => setRelationship(event.target.value)} className="h-14 w-full rounded-2xl border border-[#DCE3EC] px-5 text-sm outline-none focus:border-[#163B8C]">
                <option value="">Select relationship</option>
                {relationshipOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F172A]">Mobile Number</label>
              <Input type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Enter mobile number" />
            </div>
          </div>

          {relationship === "other" ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F172A]">Custom Relationship</label>
              <Input value={customRelationship} onChange={(event) => setCustomRelationship(event.target.value)} placeholder="Trusted advisor" />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-[#0F172A]">Notes</label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for the invitation and access mapping." rows={4} />
          </div>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting}>
              <Send className="h-4 w-4" />
              Send Invitation
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/connections">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Controlled invite flow</CardTitle>
            <CardDescription>The invitation is stored first, then access rules are assigned separately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Invitation is created and logged.",
              "Nominee accepts and moves to active.",
              "Access rules are assigned explicitly.",
              "Removed nominees lose future access but stay in audit history.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent nominees</CardTitle>
            <CardDescription>Useful context before sending another invitation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentNominees.length ? (
              recentNominees.map((nominee) => (
                <Link key={nominee.id} href={`/dashboard/family/${nominee.id}`} className="flex items-start justify-between gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4 transition hover:border-[#163B8C]">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{nominee.fullName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined)}
                    </p>
                  </div>
                  <Badge variant="secondary">{nominee.status}</Badge>
                </Link>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                No nominees have been invited yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error === authHelpText ? (
        <Card className="border-[#C7D2FE] bg-[#EEF4FF]">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-[#0F172A]">{authHelpText}</p>
            <p className="text-sm leading-6 text-slate-600">
              Sign back in to keep invitation records tied to the correct owner account.
            </p>
            <Button asChild>
              <Link href="/onboarding/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
