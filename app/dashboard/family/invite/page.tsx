"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { getErrorMessage, isAuthenticationError } from "@/lib/dashboard-errors";
import { Textarea } from "@/components/inherix/textarea";
import {
  formatRelationship,
  relationshipOptions,
} from "@/lib/records";
import { createNominee, loadNominees, type NomineeApiRecord } from "@/lib/nominees";

export default function InviteNomineePage() {
  const router = useRouter();
  const authHelpText = "Sign in to invite a nominee.";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nominees, setNominees] = useState<NomineeApiRecord[]>([]);
  const [loadingNominees, setLoadingNominees] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const payload = await loadNominees();
        if (!cancelled) {
          setNominees(payload.nominees);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(isAuthenticationError(loadError) ? authHelpText : getErrorMessage(loadError, "Unable to load nominees."));
        }
      } finally {
        if (!cancelled) {
          setLoadingNominees(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
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

      setNominees((current) => [payload.nominee, ...current.filter((item) => item.id !== payload.nominee.id)]);
      router.push(`/dashboard/family/${payload.nominee.id}`);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to send the invitation right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href="/dashboard/family">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Badge variant="default">Invite nominee</Badge>
            <Badge variant="secondary">Audit logged</Badge>
          </div>
          <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[40px]">
            Add a trusted nominee
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
            Send a controlled invitation, map the relationship and prepare future document access without exposing the full vault.
          </p>
        </div>

        <Card className="w-full max-w-[360px]">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-[#163B8C]" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">
                  Invitation outcome
                </p>
                <p className="text-xs text-slate-500">
                  Invitation records are prepared for notification delivery.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F8FAFC] p-3 text-xs text-slate-500">
              Nominees start as invited and remain hidden from unrestricted vault browsing.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nominee details</CardTitle>
            <CardDescription>
              Enter the trusted contact details that will be used for invitation and access tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Full name</label>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Rahul Sharma"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Relationship</label>
                  <select
                    value={relationship}
                    onChange={(event) => setRelationship(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                  >
                    <option value="">Select relationship</option>
                    {relationshipOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {relationship === "other" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">
                    Custom relationship
                  </label>
                  <Input
                    value={customRelationship}
                    onChange={(event) => setCustomRelationship(event.target.value)}
                    placeholder="Trusted advisor"
                  />
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Mobile number</label>
                  <Input
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F172A]">
                  Notes
                </label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Optional notes for the invitation and access mapping."
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                >
                  Send invitation
                </Button>
                <Button
                  asChild
                  variant="outline"
                >
                  <Link href="/dashboard/family">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invite journey</CardTitle>
              <CardDescription>
                The invite starts controlled and becomes active only after acceptance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Invitation is created and logged.",
                "Nominee accepts and moves to active.",
                "Access rules are applied explicitly.",
                "Removed nominees are hidden from new mappings.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4"
                >
                  <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent nominees</CardTitle>
              <CardDescription>
                Useful context before sending another invitation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingNominees ? (
                <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                  Loading nominees...
                </div>
              ) : recentNominees.length ? (
                recentNominees.map((nominee) => (
                  <Link
                    key={nominee.id}
                    href={`/dashboard/family/${nominee.id}`}
                    className="flex items-start justify-between gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4 transition hover:border-[#163B8C]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {nominee.fullName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {nominee.status}
                    </Badge>
                  </Link>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                  No nominees have been invited yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#EEF4FF]">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#163B8C]" />
                <p className="text-sm font-medium text-[#0F172A]">
                  Controlled access only
                </p>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Inviting a nominee does not grant vault browsing. Access rules are assigned separately and remain owner controlled.
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <Mail className="h-4 w-4 text-[#163B8C]" />
                Invitation notification prepared
                <Phone className="ml-2 h-4 w-4 text-[#163B8C]" />
                Contact details stored securely
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {error === authHelpText ? (
        <Card className="border-[#C7D2FE] bg-[#EEF4FF]">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-[#0F172A]">{authHelpText}</p>
            <p className="text-sm leading-6 text-slate-600">
              Sign back in to send invitations and keep nominee records in sync with the backend.
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
