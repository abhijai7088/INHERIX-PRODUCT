"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  FileText,
  Mail,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Users,
  Pencil,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Textarea } from "@/components/inherix/textarea";
import { formatDateTime, formatRelationship, getInvitationTone, getNomineeStatusTone, relationshipOptions } from "@/lib/records";
import { loadNominee, removeNominee, resendNomineeInvitation, updateNominee, type NomineeApiRecord } from "@/lib/nominees";

export default function FamilyMemberDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const nomineeId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const [nominee, setNominee] = useState<NomineeApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    relationship: "",
    customRelationship: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const payload = await loadNominee(nomineeId);
        if (cancelled) {
          return;
        }

        setNominee(payload.nominee);
        setForm({
          fullName: payload.nominee.fullName,
          email: payload.nominee.email ?? "",
          mobile: payload.nominee.mobile ?? "",
          relationship: payload.nominee.relationship,
          customRelationship: payload.nominee.customRelationship ?? "",
          notes: payload.nominee.notes ?? "",
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load nominee.");
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
  }, [nomineeId]);

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

  const relationshipLabel = useMemo(
    () => formatRelationship(form.relationship as Parameters<typeof formatRelationship>[0], form.customRelationship || undefined),
    [form.customRelationship, form.relationship]
  );

  async function handleSave() {
    if (!nominee) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = await updateNominee(nominee.id, {
        fullName: form.fullName,
        email: form.email,
        mobile: form.mobile,
        relationship: form.relationship,
        customRelationship: form.customRelationship.trim() || null,
        notes: form.notes.trim() || null,
      });

      setNominee(payload.nominee);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save nominee.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResend() {
    if (!nominee) {
      return;
    }

    setError(null);

    try {
      const payload = await resendNomineeInvitation(nominee.id);
      setNominee(payload.nominee);
      setToast({
        title: "Invitation resent",
        message: `A fresh invite link was sent to ${payload.nominee.fullName}${payload.nominee.email ? ` at ${payload.nominee.email}` : ""}.`,
      });
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Unable to resend invitation.");
    }
  }

  async function handleRemove() {
    if (!nominee) {
      return;
    }

    if (!window.confirm("Remove this nominee and keep the audit trail?")) {
      return;
    }

    setError(null);

    try {
      const payload = await removeNominee(nominee.id);
      setNominee(payload.nominee);
      router.push("/dashboard/family");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove nominee.");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8">
          <p className="text-sm font-medium text-[#163B8C]">Nominee Management</p>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Loading nominee</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500">
            Retrieving the customer-owned nominee record securely.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!nominee) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8">
          <p className="text-sm font-medium text-[#163B8C]">Nominee Management</p>
          <h1 className="text-3xl font-semibold text-[#0F172A]">Nominee not found</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500">
            The nominee is unavailable, removed, or outside the current owner scope.
          </p>
          <Button asChild>
            <Link href="/dashboard/family">
              <ArrowLeft className="h-4 w-4" />
              Back to nominees
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
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

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="icon">
                <Link href="/dashboard/family">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Badge variant="default">Nominee detail</Badge>
              <Badge variant={getNomineeStatusTone(nominee.status)}>{nominee.status}</Badge>
              <Badge variant={getInvitationTone(nominee.invitationStatus)}>{nominee.invitationStatus}</Badge>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#EEF4FF] text-xl font-semibold text-[#163B8C]">
                  {nominee.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium tracking-[0.18em] text-[#163B8C] uppercase">
                    Trusted nominee
                  </p>
                  <h1 className="text-[30px] font-semibold tracking-tight text-[#0F172A] lg:text-[42px]">
                    {nominee.fullName}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {relationshipLabel}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setEditing((current) => !current)}>
                  <Pencil className="h-4 w-4" />
                  {editing ? "Close editor" : "Edit nominee"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleResend()}
                  disabled={nominee.status === "REMOVED"}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Resend invite
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleRemove()}
                  disabled={nominee.status === "REMOVED"}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Assigned documents</p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">
                  {nominee.assignedCount}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Invitation sent</p>
                <p className="mt-2 text-sm font-medium text-[#0F172A]">
                  {formatDateTime(nominee.invitedAt)}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                <p className="text-sm text-slate-500">Accepted</p>
                <p className="mt-2 text-sm font-medium text-[#0F172A]">
                  {nominee.acceptedAt ? formatDateTime(nominee.acceptedAt) : "Not yet accepted"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status summary</CardTitle>
            <CardDescription>
              Invitation and approval lifecycle in one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Invitation sent", value: formatDateTime(nominee.invitedAt) },
              { label: "Invitation accepted", value: nominee.acceptedAt ? formatDateTime(nominee.acceptedAt) : "Not yet accepted" },
              { label: "Relationship", value: relationshipLabel },
              { label: "Visibility", value: nominee.status === "ACTIVE" ? "Active and scoped" : "Restricted until accepted" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4"
              >
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.value}</p>
                </div>
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nominee information</CardTitle>
            <CardDescription>
              Personal details and relationship mapping for this nominee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {editing ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Full name</label>
                    <Input
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Email</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Mobile</label>
                    <Input
                      value={form.mobile}
                      onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Relationship</label>
                    <select
                      value={form.relationship}
                      onChange={(event) => setForm((current) => ({ ...current, relationship: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm outline-none transition focus:border-[#163B8C]"
                    >
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

                {form.relationship === "other" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F172A]">Custom relationship</label>
                    <Input
                      value={form.customRelationship}
                      onChange={(event) => setForm((current) => ({ ...current, customRelationship: event.target.value }))}
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0F172A]">Notes</label>
                  <Textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                  />
                </div>

                <Button
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  Save nominee
                </Button>
              </>
            ) : (
              <>
                {[
                  { label: "Email", value: nominee.email ?? "Not set", icon: Mail },
                  { label: "Mobile", value: nominee.mobile ?? "Not set", icon: Phone },
                  { label: "Relationship", value: relationshipLabel, icon: Users },
                  { label: "Notes", value: nominee.notes ?? "No notes added", icon: FileText },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[24px] border border-[#DCE3EC] bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <item.icon className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                      <div>
                        <p className="text-xs text-slate-500">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-[#0F172A]">{item.value}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-5">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">Access mapping stays separate</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Nominee onboarding is complete here. Access rules and controlled release are handled in the next phase so no unreleased vault data is exposed early.
                      </p>
                    </div>
                  </div>
                </div>

                <Button asChild variant="outline">
                  <Link href={`/dashboard/family/${nominee.id}/access`}>
                    Continue to access mapping
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Controlled access note</CardTitle>
              <CardDescription>
                The nominee never gets unrestricted vault browsing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <p className="text-sm leading-6 text-slate-600">
                  Invitation acceptance is separate from document release and remains audited end to end.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white p-4">
                <Clock3 className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                <p className="text-sm leading-6 text-slate-600">
                  Access rules will be assigned after this phase, with signed URLs and controlled release in the later workflow.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
