"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, History, Mail, Phone, Plus, ShieldCheck, UserCog, Users } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import {
  createVerificationOfficerAccount,
  getVerificationOfficerAccounts,
  resendVerificationEmail,
  reissueVerificationOfficerCredentials,
  updateVerificationOfficerAccount,
  type AdminSettingsPayload,
} from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

type Officer = AdminSettingsPayload["verificationOfficers"][number];

const officerCredentialStorageKey = "inherix_officer_generated_credential";
const officerStatusStorageKey = "inherix_officer_generated_status";

export default function VerificationOfficersPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return window.sessionStorage.getItem(officerStatusStorageKey);
    } catch {
      return null;
    }
  });
  const [generatedCredential, setGeneratedCredential] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(officerCredentialStorageKey);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as { email: string; temporaryPassword: string };
    } catch {
      return null;
    }
  });
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
  });
  const [editDraft, setEditDraft] = useState({
    fullName: "",
    mobile: "",
    status: "ACTIVE",
    isEmailVerified: false,
    isMobileVerified: false,
    mfaEnabled: true,
    mustResetPassword: true,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getVerificationOfficerAccounts();
        if (!active) {
          return;
        }

        setOfficers(data);
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      } catch {
        if (active) {
          setError("Unable to load verification officers right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (generatedCredential) {
        window.sessionStorage.setItem(officerCredentialStorageKey, JSON.stringify(generatedCredential));
      } else {
        window.sessionStorage.removeItem(officerCredentialStorageKey);
      }
    } catch {
      // Keep the in-memory state even if session storage is unavailable.
    }
  }, [generatedCredential]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (message) {
        window.sessionStorage.setItem(officerStatusStorageKey, message);
      } else {
        window.sessionStorage.removeItem(officerStatusStorageKey);
      }
    } catch {
      // Keep the in-memory state even if session storage is unavailable.
    }
  }, [message]);

  const filteredOfficers = useMemo(() => {
    const activeOfficers = officers.filter(officer => officer.status !== 'INACTIVE');
    
    const term = search.trim().toLowerCase();
    if (!term) {
      return activeOfficers;
    }

    return activeOfficers.filter((officer) =>
      [officer.fullName, officer.email, officer.role, officer.status].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [officers, search]);

  const selectedOfficer = filteredOfficers.find((officer) => officer.id === selectedId) ?? filteredOfficers[0] ?? null;

  useEffect(() => {
    if (!selectedOfficer) {
      return;
    }

    setEditDraft({
      fullName: selectedOfficer.fullName,
      mobile: selectedOfficer.mobile ?? "",
      status: selectedOfficer.status,
      isEmailVerified: selectedOfficer.isEmailVerified,
      isMobileVerified: selectedOfficer.isMobileVerified,
      mfaEnabled: selectedOfficer.mfaEnabled,
      mustResetPassword: selectedOfficer.mustResetPassword,
    });
  }, [selectedOfficer]);

  useEffect(() => {
    if (!loading && officers.length > 0 && error === "Route not found.") {
      setError(null);
    }
  }, [error, loading, officers.length]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Verification Officers"
          description="Super admin can create, update, verify and reissue officer access from this live control surface."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading verification officers...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !officers.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Verification Officers"
          description="Super admin can create, update, verify and reissue officer access from this live control surface."
        />
        <Card className="border-[#F2C9C9] bg-[#FFF7F7]">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold text-[#7F1D1D]">Live data unavailable</p>
            <p className="text-sm leading-6 text-[#991B1B]">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const refresh = async (nextSelectedId?: string) => {
    const data = await getVerificationOfficerAccounts();
    setOfficers(data);
    setSelectedId(nextSelectedId ?? data.find((item) => item.id === selectedId)?.id ?? data[0]?.id ?? null);
  };

  const createOfficer = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    setGeneratedCredential(null);

    try {
      const result = await createVerificationOfficerAccount({
        fullName: form.fullName,
        email: form.email,
        mobile: form.mobile || null,
      });

      setGeneratedCredential({
        email: result.email,
        temporaryPassword: result.temporaryPassword,
      });
      setMessage(
        `Verification officer created. Temporary password: ${result.temporaryPassword}. Email verification is required before first sign-in.`
      );
      setForm({ fullName: "", email: "", mobile: "" });
      await refresh(result.userId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create verification officer.");
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedOfficer = async () => {
    if (!selectedOfficer) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateVerificationOfficerAccount(selectedOfficer.id, {
        fullName: editDraft.fullName,
        mobile: editDraft.mobile || null,
        status: editDraft.status,
        isEmailVerified: editDraft.isEmailVerified,
        isMobileVerified: editDraft.isMobileVerified,
        mfaEnabled: editDraft.mfaEnabled,
        mustResetPassword: editDraft.mustResetPassword,
      });
      setMessage("Verification officer updated successfully.");
      await refresh(selectedOfficer.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update officer.");
    } finally {
      setSaving(false);
    }
  };

  const resendSelectedVerification = async () => {
    if (!selectedOfficer) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await resendVerificationEmail(selectedOfficer.id);
      setMessage("Verification email resent.");
      await refresh(selectedOfficer.id);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Unable to resend verification email.");
    } finally {
      setSaving(false);
    }
  };

  const reissueSelectedCredential = async () => {
    if (!selectedOfficer) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    setGeneratedCredential(null);
    try {
      const result = await reissueVerificationOfficerCredentials(selectedOfficer.id);
      setGeneratedCredential({
        email: result.email,
        temporaryPassword: result.temporaryPassword,
      });
      setMessage(
        `Temporary credential reissued. This replaces the previous password. New password: ${result.temporaryPassword}. Send it securely to the officer.`
      );
      await refresh(selectedOfficer.id);
    } catch (reissueError) {
      setError(reissueError instanceof Error ? reissueError.message : "Unable to reissue credentials.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedOfficer = async () => {
    if (!selectedOfficer) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateVerificationOfficerAccount(selectedOfficer.id, {
        status: "INACTIVE",
      });
      setMessage("Verification officer deleted.");
      await refresh(selectedOfficer.id);
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : "Unable to delete officer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin"
        title="Verification Officers"
        description="Create and review verification officers from a single secure control surface."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">
                <UserCog className="h-4 w-4" />
                Back to settings
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/rbac">
                <ShieldCheck className="h-4 w-4" />
                Manage RBAC
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratedCredential(null);
                setMessage(null);
                setError(null);
              }}
              disabled={!generatedCredential && !message && !error}
            >
              Clear secret
            </Button>
          </div>
        }
      />

      {(message || error) && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{error ? "Action blocked" : "Update complete"}</p>
              <p className="text-sm text-slate-600">{error ?? message}</p>
            </div>
            {error ? <Badge variant="destructive">Attention</Badge> : <Badge variant="success">Saved</Badge>}
          </CardContent>
        </Card>
      )}

      {generatedCredential ? (
        <Card className="border-[#BBD4FF] bg-[#F5FAFF]">
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Temporary credential generated</p>
                <p className="text-sm text-slate-600">{generatedCredential.email}</p>
              </div>
              <Badge variant="warning">One-time password</Badge>
            </div>
            <div className="rounded-2xl border border-dashed border-[#BBD4FF] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Use this password once</p>
              <p className="mt-2 break-all font-mono text-sm text-[#0F172A]">{generatedCredential.temporaryPassword}</p>
            </div>
            <p className="text-xs leading-6 text-slate-500">
              Send this credential through a secure channel. The officer must verify the email before the first login.
              Reissuing a credential generates a fresh password and invalidates the earlier one.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="space-y-5 p-6">
            <SectionHeader
              title="Officer directory"
              description="A clean list of verification officers with their live account posture."
            />

            <div className="flex items-center gap-3 rounded-[22px] border border-[#DCE3EC] bg-[#F8FAFC] px-4 py-3">
              <Users className="h-4 w-4 text-[#163B8C]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search officer name, email, role or status"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="space-y-3">
              {filteredOfficers.map((officer) => {
                const active = officer.id === selectedOfficer?.id;
                return (
                  <button
                    key={officer.id}
                    type="button"
                    onClick={() => setSelectedId(officer.id)}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      active ? "border-[#163B8C] bg-[#EEF4FF]" : "border-[#E5ECF5] bg-white hover:border-[#C9D8F3]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#0F172A]">{officer.fullName}</h3>
                        <p className="mt-1 text-sm text-slate-500">{officer.email}</p>
                      </div>
                      <Badge variant="secondary">{officer.role}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={officer.isEmailVerified ? "success" : "warning"}>
                        {officer.isEmailVerified ? "email verified" : "email pending"}
                      </Badge>
                      <Badge variant={officer.mfaEnabled ? "success" : "warning"}>
                        {officer.mfaEnabled ? "otp enabled" : "otp pending"}
                      </Badge>
                      <Badge variant="secondary">{officer.status}</Badge>
                    </div>
                  </button>
                );
              })}

              {!loading && !filteredOfficers.length ? (
                <div className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-slate-500">
                  No verification officers match the current filter.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Officer detail</CardTitle>
              <CardDescription>Review identity, verification state, and sign-in readiness.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedOfficer ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-[#0F172A]">{selectedOfficer.fullName}</h3>
                      <p className="mt-1 text-sm text-slate-500">{selectedOfficer.email}</p>
                    </div>
                    <Badge variant="secondary">{selectedOfficer.role}</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Mobile</p>
                      <p className="mt-2 text-sm font-medium text-[#0F172A]">{selectedOfficer.mobile ?? "Not provided"}</p>
                    </div>
                    <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Created</p>
                      <p className="mt-2 text-sm font-medium text-[#0F172A]">{formatDateTime(selectedOfficer.createdAt)}</p>
                    </div>
                    <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Last login</p>
                      <p className="mt-2 text-sm font-medium text-[#0F172A]">
                        {selectedOfficer.lastLoginAt ? formatDateTime(selectedOfficer.lastLoginAt) : "No login yet"}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Active sessions</p>
                      <p className="mt-2 text-sm font-medium text-[#0F172A]">{selectedOfficer.activeSessionCount}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={selectedOfficer.isEmailVerified ? "success" : "warning"}>
                      {selectedOfficer.isEmailVerified ? "email verified" : "email pending"}
                    </Badge>
                    <Badge variant={selectedOfficer.isMobileVerified ? "success" : "warning"}>
                      {selectedOfficer.isMobileVerified ? "mobile verified" : "mobile pending"}
                    </Badge>
                    <Badge variant={selectedOfficer.mfaEnabled ? "success" : "warning"}>
                      {selectedOfficer.mfaEnabled ? "otp enabled" : "otp pending"}
                    </Badge>
                    <Badge variant={selectedOfficer.mustResetPassword ? "warning" : "success"}>
                      {selectedOfficer.mustResetPassword ? "password reset required" : "password settled"}
                    </Badge>
                    <Badge variant="secondary">{selectedOfficer.status}</Badge>
                  </div>

                  <div className="space-y-3 rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                    <p className="text-sm font-semibold text-[#0F172A]">Edit officer</p>
                    <Input
                      value={editDraft.fullName}
                      onChange={(event) => setEditDraft((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder="Full name"
                    />
                    <Input
                      value={editDraft.mobile}
                      onChange={(event) => setEditDraft((current) => ({ ...current, mobile: event.target.value }))}
                      placeholder="Mobile number"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={editDraft.status}
                        onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value }))}
                        placeholder="Status"
                      />
                      <label className="flex items-center gap-2 rounded-2xl border border-[#DCE3EC] px-4 py-3 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={editDraft.mustResetPassword}
                          onChange={(event) => setEditDraft((current) => ({ ...current, mustResetPassword: event.target.checked }))}
                        />
                        Force password reset
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex items-center gap-2 rounded-2xl border border-[#DCE3EC] px-4 py-3 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={editDraft.isEmailVerified}
                          onChange={(event) => setEditDraft((current) => ({ ...current, isEmailVerified: event.target.checked }))}
                        />
                        Email verified
                      </label>
                      <label className="flex items-center gap-2 rounded-2xl border border-[#DCE3EC] px-4 py-3 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={editDraft.isMobileVerified}
                          onChange={(event) => setEditDraft((current) => ({ ...current, isMobileVerified: event.target.checked }))}
                        />
                        Mobile verified
                      </label>
                      <label className="flex items-center gap-2 rounded-2xl border border-[#DCE3EC] px-4 py-3 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={editDraft.mfaEnabled}
                          onChange={(event) => setEditDraft((current) => ({ ...current, mfaEnabled: event.target.checked }))}
                        />
                        OTP enabled
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={saveSelectedOfficer} disabled={saving}>
                        <UserCog className="h-4 w-4" />
                        {saving ? "Saving..." : "Save changes"}
                      </Button>
                      <Button type="button" variant="outline" onClick={resendSelectedVerification} disabled={saving}>
                        Resend verification link
                      </Button>
                      <Button type="button" variant="outline" onClick={reissueSelectedCredential} disabled={saving}>
                        Reissue password
                      </Button>
                      <Button type="button" variant="destructive" onClick={deleteSelectedOfficer} disabled={saving}>
                        Delete officer
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/dashboard/audit">
                          <History className="h-4 w-4" />
                          Open audit trail
                        </Link>
                      </Button>
                    </div>

                    <p className="text-xs leading-6 text-slate-500">
                      Saving updates keeps the officer active in the control plane. Reissue creates a fresh temporary password, invalidates the old one, and re-locks the account. Resend verification only sends the email verification link.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-slate-500">
                  Select an officer to see account details.
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="create-officer" className="scroll-mt-28">
            <CardHeader>
              <CardTitle>Create officer</CardTitle>
              <CardDescription>Super admin creates the account, sends verification, and shares the temporary password securely.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Full name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
              <Input placeholder="Email address" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              <Input placeholder="Mobile number" value={form.mobile} onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))} />
              <Button type="button" onClick={createOfficer} disabled={saving}>
                <Plus className="h-4 w-4" />
                {saving ? "Creating..." : "Create verification officer"}
              </Button>
              <div className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                <Mail className="mt-0.5 h-4 w-4 text-[#163B8B]" />
                <p className="text-sm leading-6 text-slate-600">
                  The account will not be usable until the officer verifies the email link and then completes OTP on sign-in.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                <Phone className="mt-0.5 h-4 w-4 text-[#163B8B]" />
                <p className="text-sm leading-6 text-slate-600">
                  This page is intentionally separate from the main settings screen so officer management stays focused.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-[#EEF4FF]">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Need the role matrix?</p>
            <p className="text-sm text-slate-600">Open RBAC to review exactly what the verification officer can and cannot do.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/rbac">
              Open RBAC
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
