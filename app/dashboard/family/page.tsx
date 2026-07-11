"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Users,
  FileText,
  RefreshCcw,
  Pencil,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { getErrorMessage, isAuthenticationError, isDatabaseUnavailableError } from "@/lib/dashboard-errors";
import { formatDateTime, formatRelationship, getInvitationTone, getNomineeStatusTone } from "@/lib/records";
import { loadNominees, removeNominee, resendNomineeInvitation, type NomineeApiRecord } from "@/lib/nominees";

export default function FamilyPage() {
  const authHelpText = "Sign in to view nominee management.";
  const databaseHelpText = "The backend cannot reach PostgreSQL right now. Start PostgreSQL and refresh this page.";
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [nominees, setNominees] = useState<NomineeApiRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

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
          if (isAuthenticationError(loadError)) {
            setError(authHelpText);
          } else if (isDatabaseUnavailableError(loadError)) {
            setError(databaseHelpText);
          } else {
            setError(getErrorMessage(loadError, "Unable to load nominees."));
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const visibleNominees = useMemo(
    () =>
      nominees
        .filter((nominee) => (showArchived ? nominee.status === "REMOVED" : nominee.status !== "REMOVED"))
        .filter((nominee) =>
          [
            nominee.fullName,
            nominee.email,
            nominee.mobile,
            nominee.status,
            nominee.invitationStatus,
            formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [nominees, query, showArchived]
  );

  const activeNominees = useMemo(
    () => nominees.filter((nominee) => nominee.status !== "REMOVED"),
    [nominees]
  );

  const archivedNominees = useMemo(
    () => nominees.filter((nominee) => nominee.status === "REMOVED"),
    [nominees]
  );

  const stats = useMemo(
    () => ({
      total: nominees.length,
      active: activeNominees.filter((nominee) => nominee.status === "ACTIVE").length,
      invited: activeNominees.filter((nominee) => nominee.status === "INVITED").length,
      removed: archivedNominees.length,
    }),
    [activeNominees, archivedNominees, nominees]
  );

  async function handleResend(nomineeId: string) {
    setError(null);

    try {
      const payload = await resendNomineeInvitation(nomineeId);
      setNominees((current) => current.map((nominee) => (nominee.id === payload.nominee.id ? payload.nominee : nominee)));
      setToast({
        title: "Invitation resent",
        message: `A fresh invite link was sent to ${payload.nominee.fullName}${payload.nominee.email ? ` at ${payload.nominee.email}` : ""}.`,
      });
    } catch (resendError) {
      if (isAuthenticationError(resendError)) {
        setError(authHelpText);
      } else if (isDatabaseUnavailableError(resendError)) {
        setError(databaseHelpText);
      } else {
        setError(getErrorMessage(resendError, "Unable to resend the invitation."));
      }
    }
  }

  async function handleRemove(nomineeId: string) {
    if (!window.confirm("Delete this nominee?")) {
      return;
    }

    setError(null);

    try {
      const payload = await removeNominee(nomineeId);
      setNominees((current) => current.map((nominee) => (nominee.id === payload.nominee.id ? payload.nominee : nominee)));
    } catch (removeError) {
      if (isAuthenticationError(removeError)) {
        setError(authHelpText);
      } else if (isDatabaseUnavailableError(removeError)) {
        setError(databaseHelpText);
      } else {
        setError(getErrorMessage(removeError, "Unable to remove this nominee."));
      }
    }
  }

  return (
    <div className="space-y-8">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-950">{toast.title}</p>
              <p className="mt-1 text-sm leading-6 text-emerald-900/80">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 rounded-full px-2 text-emerald-900/60 transition hover:bg-emerald-100 hover:text-emerald-900"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Nominee Management</Badge>
              <Badge variant="secondary">Ownership scoped</Badge>
              <Badge variant="secondary">Audit logged</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                Trusted Access Layer
              </p>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#0F172A] lg:text-[44px]">
                Manage nominees without exposing the vault.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 lg:text-base">
                Invite trusted nominees, map relationships and keep every visibility change auditable.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard/family/invite">
                  <Plus className="h-4 w-4" />
                  Invite nominee
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard/family/verification">
                  <ShieldCheck className="h-4 w-4" />
                  Status view
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Nominees</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.total}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Active</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.active}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Invited</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.invited}</p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Removed</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{stats.removed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visibility rules</CardTitle>
            <CardDescription>
              Nominees only see assigned access. They never browse the full vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Invitation and acceptance states stay visible to the owner.",
              "Removed nominees remain in the audit trail but lose future access.",
              "Access rule management stays separate from nominee onboarding.",
              "Every change is written to the audit trail.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4"
              >
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search nominee name, relationship, email or status..."
                className="pl-12"
              />
            </div>

            <Button asChild variant="outline">
              <Link href="/dashboard/family/invite">
                <Plus className="h-4 w-4" />
                Invite nominee
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {error === authHelpText ? (
        <Card className="border-[#C7D2FE] bg-[#EEF4FF]">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-[#0F172A]">{authHelpText}</p>
            <p className="text-sm leading-6 text-slate-600">
              Sign in again to see your nominees, invitation history, and visibility rules.
            </p>
            <Button asChild>
              <Link href="/onboarding/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      ) : error === databaseHelpText ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium text-amber-900">PostgreSQL is not ready.</p>
            <p className="text-sm leading-6 text-amber-800/90">
              Start the local PostgreSQL service, then refresh the nominee page so the backend can load real nominee data.
            </p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4">


        {loading ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Loading nominees...
            </CardContent>
          </Card>
        ) : visibleNominees.length ? (
          visibleNominees.map((nominee) => (
            <Card
              key={nominee.id}
              className="overflow-hidden"
            >
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <Link
                    href={`/dashboard/family/${nominee.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] font-semibold text-[#163B8C]">
                        {nominee.fullName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-[#0F172A]">
                            {nominee.fullName}
                          </h3>
                          <Badge variant={getNomineeStatusTone(nominee.status)}>
                            {nominee.status === "REMOVED" ? "ARCHIVED" : nominee.status}
                          </Badge>
                          {nominee.status !== "REMOVED" ? (
                            <Badge variant={getInvitationTone(nominee.invitationStatus)}>
                              {nominee.invitationStatus}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="text-sm text-slate-500">
                          {formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined)}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Mail className="h-4 w-4 text-[#163B8C]" />
                            {nominee.email ?? "No email"}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <Phone className="h-4 w-4 text-[#163B8C]" />
                            {nominee.mobile ?? "No mobile"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span>{nominee.assignedCount} assigned document{nominee.assignedCount === 1 ? "" : "s"}</span>
                          <span aria-hidden="true">•</span>
                          <span>Updated {formatDateTime(nominee.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/family/${nominee.id}`}>
                        <ArrowRight className="h-4 w-4" />
                        View
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleResend(nominee.id)}
                      disabled={nominee.status === "REMOVED" || nominee.status === "ACTIVE"}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Resend
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                    >
                      <Link href={`/dashboard/family/${nominee.id}`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleRemove(nominee.id)}
                      disabled={nominee.status === "REMOVED"}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-[#163B8C]" />
              <p className="mt-4 text-base font-medium text-[#0F172A]">No nominees match your search</p>
              <p className="mt-2 text-sm text-slate-500">
                Invite a trusted nominee to start building access rules.
              </p>
              <Button asChild className="mt-5">
                <Link href="/dashboard/family/invite">
                  Invite nominee
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Owner snapshot</CardTitle>
          <CardDescription>
            Nominee onboarding and state changes are retained in the backend audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {activeNominees.slice(0, 4).map((nominee) => (
            <div
              key={nominee.id}
              className="rounded-[24px] border border-[#DCE3EC] bg-white p-4"
            >
              <p className="text-sm font-medium text-[#0F172A]">
                {nominee.fullName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatRelationship(nominee.relationship as Parameters<typeof formatRelationship>[0], nominee.customRelationship ?? undefined)}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <FileText className="h-3.5 w-3.5" />
                {nominee.assignedCount} assigned document{nominee.assignedCount === 1 ? "" : "s"}
              </div>
            </div>
          ))}

          {!activeNominees.length ? (
            <div className="rounded-[24px] border border-dashed border-[#DCE3EC] bg-[#F8FAFC] p-5 text-sm text-slate-500 md:col-span-2">
              No active nominees are available. Switch to Archived list to review removed records.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
