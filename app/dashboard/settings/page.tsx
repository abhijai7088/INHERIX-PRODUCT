"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, Plus, ServerCog, ShieldAlert, ShieldCheck, SlidersHorizontal, UserCog, Users } from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import {
  createAdminAccount,
  getAdminSettings,
  updateAdminAccount,
  updateAdminSettings,
  type AdminSettingsPayload,
} from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

type SettingDrafts = Record<string, string>;
type AdminDrafts = Record<
  string,
  {
    fullName: string;
    mobile: string;
    role: "ADMIN" | "SUPER_ADMIN";
    status: string;
    mfaEnabled: boolean;
    isEmailVerified: boolean;
    isMobileVerified: boolean;
  }
>;

const adminCredentialStorageKey = "inherix_admin_generated_credential";
const adminStatusStorageKey = "inherix_admin_generated_status";

export default function SettingsPage() {
  const [payload, setPayload] = useState<AdminSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminSavingId, setAdminSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return window.sessionStorage.getItem(adminStatusStorageKey);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [settingDrafts, setSettingDrafts] = useState<SettingDrafts>({});
  const [adminDrafts, setAdminDrafts] = useState<AdminDrafts>({});
  const [generatedCredential, setGeneratedCredential] = useState<{
    role: "ADMIN" | "SUPER_ADMIN" | "VERIFICATION_OFFICER";
    email: string;
    temporaryPassword: string;
  } | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(adminCredentialStorageKey);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as {
        role: "ADMIN" | "SUPER_ADMIN" | "VERIFICATION_OFFICER";
        email: string;
        temporaryPassword: string;
      };
    } catch {
      return null;
    }
  });
  const [newAdmin, setNewAdmin] = useState({
    fullName: "",
    email: "",
    mobile: "",
    role: "ADMIN" as "ADMIN" | "SUPER_ADMIN",
  });

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    section?.classList.add("ring-2", "ring-[#BBD4FF]", "ring-offset-4", "ring-offset-white");
    window.setTimeout(() => {
      section?.classList.remove("ring-2", "ring-[#BBD4FF]", "ring-offset-4", "ring-offset-white");
    }, 1400);
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminSettings();
        if (!active) {
          return;
        }

        setPayload(data);
        setSettingDrafts(
          Object.fromEntries(
            data.groups.flatMap((group) => group.items.map((item) => [item.key, item.value]))
          )
        );
        setAdminDrafts(
          Object.fromEntries(
            data.admins.map((admin) => [
              admin.id,
              {
                fullName: admin.fullName,
                mobile: admin.mobile ?? "",
                role: admin.role,
                status: admin.status,
                mfaEnabled: admin.mfaEnabled,
                isEmailVerified: admin.isEmailVerified,
                isMobileVerified: admin.isMobileVerified,
              },
            ])
          )
        );
      } catch {
        if (active) {
          setPayload(null);
          setError("Unable to load settings right now.");
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
        window.sessionStorage.setItem(adminCredentialStorageKey, JSON.stringify(generatedCredential));
      } else {
        window.sessionStorage.removeItem(adminCredentialStorageKey);
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
        window.sessionStorage.setItem(adminStatusStorageKey, message);
      } else {
        window.sessionStorage.removeItem(adminStatusStorageKey);
      }
    } catch {
      // Keep the in-memory state even if session storage is unavailable.
    }
  }, [message]);

  const groupCount = payload?.groups.length ?? 0;
  const missingSecrets = payload?.readiness.missingProductionSecrets?.length ?? 0;
  const recentChanges = payload?.recentChanges.length ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Settings"
          description="A live configuration surface for platform identity, security defaults, delivery posture, admin accounts and retention policy."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading live settings snapshot...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Settings"
          description="A live configuration surface for platform identity, security defaults, delivery posture, admin accounts and retention policy."
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

  const saveSettings = async () => {
    if (!payload) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updates = payload.groups.flatMap((group) =>
        group.items
          .map((item) => ({
            key: item.key,
            value: settingDrafts[item.key] ?? item.value,
            original: item.value,
          }))
          .filter((item) => item.value !== item.original)
          .map(({ key, value }) => ({ key, value }))
      );

      if (!updates.length) {
        setMessage("No setting changes were detected.");
        return;
      }

      await updateAdminSettings(updates);
      setMessage("Platform settings updated successfully.");

      const refreshed = await getAdminSettings();
      setPayload(refreshed);
      setSettingDrafts(
        Object.fromEntries(refreshed.groups.flatMap((group) => group.items.map((item) => [item.key, item.value])))
      );
      setAdminDrafts(
        Object.fromEntries(
          refreshed.admins.map((admin) => [
            admin.id,
            {
              fullName: admin.fullName,
              mobile: admin.mobile ?? "",
              role: admin.role,
              status: admin.status,
              mfaEnabled: admin.mfaEnabled,
              isEmailVerified: admin.isEmailVerified,
              isMobileVerified: admin.isMobileVerified,
            },
          ])
        )
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const saveAdmin = async (adminId: string) => {
    const draft = adminDrafts[adminId];
    if (!draft) {
      return;
    }

    setAdminSavingId(adminId);
    setError(null);
    setMessage(null);
    try {
      await updateAdminAccount(adminId, {
        fullName: draft.fullName,
        mobile: draft.mobile || null,
        role: draft.role,
        status: draft.status,
        mfaEnabled: draft.mfaEnabled,
        isEmailVerified: draft.isEmailVerified,
        isMobileVerified: draft.isMobileVerified,
      });

      setMessage("Admin account updated successfully.");
      const refreshed = await getAdminSettings();
      setPayload(refreshed);
      setAdminDrafts(
        Object.fromEntries(
          refreshed.admins.map((admin) => [
            admin.id,
            {
              fullName: admin.fullName,
              mobile: admin.mobile ?? "",
              role: admin.role,
              status: admin.status,
              mfaEnabled: admin.mfaEnabled,
              isEmailVerified: admin.isEmailVerified,
              isMobileVerified: admin.isMobileVerified,
            },
          ])
        )
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update admin account.");
    } finally {
      setAdminSavingId(null);
    }
  };

  const addAdmin = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    setGeneratedCredential(null);
    try {
      const result = await createAdminAccount({
        fullName: newAdmin.fullName,
        email: newAdmin.email,
        mobile: newAdmin.mobile || null,
        role: newAdmin.role,
      });

      setGeneratedCredential({
        role: result.role,
        email: result.email,
        temporaryPassword: result.temporaryPassword,
      });
      setMessage(`Admin account created. Temporary password: ${result.temporaryPassword}. Share it securely and complete email verification.`);
      setNewAdmin({ fullName: "", email: "", mobile: "", role: "ADMIN" });
      const refreshed = await getAdminSettings();
      setPayload(refreshed);
      setSettingDrafts(
        Object.fromEntries(refreshed.groups.flatMap((group) => group.items.map((item) => [item.key, item.value])))
      );
      setAdminDrafts(
        Object.fromEntries(
          refreshed.admins.map((admin) => [
            admin.id,
            {
              fullName: admin.fullName,
              mobile: admin.mobile ?? "",
              role: admin.role,
              status: admin.status,
              mfaEnabled: admin.mfaEnabled,
              isEmailVerified: admin.isEmailVerified,
              isMobileVerified: admin.isMobileVerified,
            },
          ])
        )
      );
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create admin account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="A live configuration surface for platform identity, security defaults, delivery posture, admin accounts and retention policy."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.assign("/dashboard/officers")}
              disabled={loading}
            >
              <Users className="h-4 w-4" />
              Manage officers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.assign("/dashboard/rbac")}
              disabled={loading}
            >
              <UserCog className="h-4 w-4" />
              Manage RBAC
            </Button>
            <Button variant="outline" size="sm" onClick={saveSettings} disabled={saving || loading}>
              <ServerCog className="h-4 w-4" />
              {saving ? "Saving..." : "Save configuration"}
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

      <Card className="border-[#BBD4FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#FFFFFF_100%)]">
        <CardContent className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Admin & Officer Setup</p>
            <h2 className="text-2xl font-semibold text-[#0F172A]">Create the privileged accounts that keep the platform running.</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Use this surface to add new admins, provision verification officers, and jump directly into the live management screens without hunting through the rest of Settings.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" onClick={() => scrollToSection("create-admin")}>
                  <UserCog className="h-4 w-4" />
                  Create admin
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/officers#create-officer">
                  <Users className="h-4 w-4" />
                  Create officer
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/officers">
                  <ShieldCheck className="h-4 w-4" />
                  Officer registry
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Create admin",
                hint: "Open the admin form and create a new privileged account.",
                href: "/dashboard/settings#create-admin",
                action: "Open form",
                icon: UserCog,
                tone: "bg-[#EEF4FF] text-[#163B8C]",
                local: true,
              },
              {
                label: "Create officer",
                hint: "Jump to the real officer registry and create the verification officer there.",
                href: "/dashboard/officers#create-officer",
                action: "Open form",
                icon: Users,
                tone: "bg-[#F4F8FF] text-[#163B8C]",
              },
              {
                label: "RBAC",
                hint: "Review the live role and permission matrix.",
                href: "/dashboard/rbac",
                action: "Open RBAC",
                icon: ShieldCheck,
                tone: "bg-[#F1FDF8] text-[#0F7A4A]",
              },
              {
                label: "Security center",
                hint: "Inspect security events and operational risk signals.",
                href: "/dashboard/security",
                action: "Open center",
                icon: ServerCog,
                tone: "bg-[#FFF7ED] text-[#C76A00]",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="rounded-[24px] border border-[#DCE3EC] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {item.local ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => scrollToSection("create-admin")}>
                        {item.action}
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={item.href}>{item.action}</Link>
                      </Button>
                    )}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#0F172A]">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                <p className="text-sm text-slate-600">
                  Role: {generatedCredential.role} | Email: {generatedCredential.email}
                </p>
              </div>
              <Badge variant="warning">One-time secret</Badge>
            </div>
            <div className="rounded-2xl border border-dashed border-[#BBD4FF] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Temporary password</p>
              <p className="mt-2 break-all font-mono text-sm text-[#0F172A]">{generatedCredential.temporaryPassword}</p>
            </div>
            <p className="text-xs leading-6 text-slate-500">
              Share this password securely. The account must verify its email before the first privileged sign-in.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Groups", value: groupCount, detail: "Configuration sections", icon: SlidersHorizontal },
          { label: "Recent changes", value: recentChanges, detail: "Audited configuration events", icon: Clock3 },
          { label: "Missing secrets", value: missingSecrets, detail: "Production blockers", icon: ShieldAlert },
          {
            label: "Readiness",
            value: payload?.readiness.status === "ready" ? "Ready" : "Review",
            detail: "Deployment posture",
            icon: ShieldCheck,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label}>
              <CardContent className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <SectionHeader
              title="Configuration groups"
              description="The control plane exposes the live values used by the backend and the delivery stack."
            />

            <div className="space-y-4">
              {(payload?.groups ?? []).map((group) => (
                <Card key={group.title}>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-[#0F172A]">{group.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{group.description}</p>
                      </div>
                      <Badge variant="secondary">{group.items.length} items</Badge>
                    </div>

                    <div className="grid gap-3">
                      {group.items.map((item) => (
                        <div key={item.key} className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-[#0F172A]">{item.label}</h3>
                                <Badge variant={item.editableBy === "super_admin" ? "warning" : "secondary"}>
                                  {item.editableBy}
                                </Badge>
                                {item.sensitive ? <Badge variant="destructive">sensitive</Badge> : null}
                              </div>
                              <p className="text-sm leading-6 text-slate-500">{item.description}</p>
                              <p className="text-xs text-slate-500">Source: {item.source}</p>
                            </div>

                            <div className="w-full max-w-[380px] space-y-2">
                              <Input
                                value={settingDrafts[item.key] ?? item.value}
                                onChange={(event) =>
                                  setSettingDrafts((current) => ({
                                    ...current,
                                    [item.key]: event.target.value,
                                  }))
                                }
                                className="rounded-2xl border-[#DCE3EC] bg-[#FAFCFF] px-4 py-3 text-sm font-medium text-[#0F172A]"
                              />
                              <p className="text-xs text-slate-500">Last synced {formatDateTime(item.lastUpdatedAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Card id="admin-accounts" className="scroll-mt-28">
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Admin accounts"
                  description="Provision or adjust privileged accounts that run the operational console."
                />

                <div className="space-y-3">
                  {(payload?.admins ?? []).map((admin) => {
                    const draft = adminDrafts[admin.id];

                    return (
                      <div key={admin.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-[#0F172A]">{admin.fullName}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{admin.email}</p>
                          </div>
                          <Badge variant={admin.role === "SUPER_ADMIN" ? "warning" : "secondary"}>{admin.role}</Badge>
                        </div>

                        {draft ? (
                          <div className="grid gap-3">
                            <Input value={draft.fullName} onChange={(event) => setAdminDrafts((current) => ({ ...current, [admin.id]: { ...draft, fullName: event.target.value } }))} />
                            <Input value={draft.mobile} onChange={(event) => setAdminDrafts((current) => ({ ...current, [admin.id]: { ...draft, mobile: event.target.value } }))} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Input value={draft.status} onChange={(event) => setAdminDrafts((current) => ({ ...current, [admin.id]: { ...draft, status: event.target.value } }))} />
                              <select
                                value={draft.role}
                                onChange={(event) =>
                                  setAdminDrafts((current) => ({
                                    ...current,
                                    [admin.id]: { ...draft, role: event.target.value === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN" },
                                  }))
                                }
                                className="h-11 rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm text-[#0F172A]"
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                              </select>
                            </div>

                            <label className="flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                checked={draft.mfaEnabled}
                                onChange={(event) => setAdminDrafts((current) => ({ ...current, [admin.id]: { ...draft, mfaEnabled: event.target.checked } }))}
                              />
                              MFA enabled
                            </label>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{admin.activeSessionCount} active sessions</Badge>
                              <Badge variant={admin.isEmailVerified ? "success" : "warning"}>
                                {admin.isEmailVerified ? "email verified" : "email pending"}
                              </Badge>
                              <Badge variant={admin.isMobileVerified ? "success" : "warning"}>
                                {admin.isMobileVerified ? "mobile verified" : "mobile pending"}
                              </Badge>
                            </div>

                            <Button
                              type="button"
                              onClick={() => saveAdmin(admin.id)}
                              disabled={adminSavingId === admin.id}
                            >
                              <UserCog className="h-4 w-4" />
                              {adminSavingId === admin.id ? "Saving..." : "Update admin"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div id="verification-officers" className="rounded-[22px] border border-[#E5ECF5] bg-white p-4 scroll-mt-28">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">Verification officers</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Officers are created only by super admin and must verify their email before sign-in.
                      </p>
                    </div>
                    <Badge variant="secondary">{payload?.verificationOfficers?.length ?? 0}</Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(payload?.verificationOfficers ?? []).map((officer) => (
                      <div key={officer.id} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-[#0F172A]">{officer.fullName}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{officer.email}</p>
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
                          <Badge variant="secondary">{officer.activeSessionCount} active sessions</Badge>
                        </div>
                      </div>
                    ))}
                    {!(payload?.verificationOfficers?.length ?? 0) ? (
                      <div className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-slate-500">
                        No verification officers have been created yet.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div id="create-admin" className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 scroll-mt-28">
                  <p className="text-sm font-semibold text-[#0F172A]">Create a new admin</p>
                  <div className="mt-3 grid gap-3">
                    <Input placeholder="Full name" value={newAdmin.fullName} onChange={(event) => setNewAdmin((current) => ({ ...current, fullName: event.target.value }))} />
                    <Input placeholder="Email address" value={newAdmin.email} onChange={(event) => setNewAdmin((current) => ({ ...current, email: event.target.value }))} />
                    <Input placeholder="Mobile number" value={newAdmin.mobile} onChange={(event) => setNewAdmin((current) => ({ ...current, mobile: event.target.value }))} />
                    <select
                      value={newAdmin.role}
                      onChange={(event) => setNewAdmin((current) => ({ ...current, role: event.target.value === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN" }))}
                      className="h-11 rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm text-[#0F172A]"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                    <Button type="button" onClick={addAdmin} disabled={saving}>
                      <Plus className="h-4 w-4" />
                      {saving ? "Creating..." : "Create admin"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
                  <p className="text-sm font-semibold text-[#0F172A]">Create a verification officer</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Creation happens in the officer registry so the account, verification email, reissue and deactivation flow stay in one audited place.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href="/dashboard/officers#create-officer">
                        <Plus className="h-4 w-4" />
                        Open create form
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/officers">
                        <ShieldCheck className="h-4 w-4" />
                        Open officer registry
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Readiness"
                  description="Production deployment indicators read from the current runtime environment."
                />

                <div className="space-y-3">
                  {[
                    { label: "Database", status: payload?.readiness.databaseConfigured ? "ready" : "missing" },
                    { label: "Storage", status: payload?.readiness.storageConfigured ? "ready" : "missing" },
                    { label: "Signing", status: payload?.readiness.signingConfigured ? "ready" : "missing" },
                    { label: "KMS", status: payload?.readiness.kmsConfigured ? "ready" : "missing" },
                    { label: "Notifications", status: payload?.readiness.notificationsConfigured ? "ready" : "missing" },
                    { label: "Auth", status: payload?.readiness.authConfigured ? "ready" : "missing" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-[22px] border border-[#E5ECF5] bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                      </div>
                      <Badge variant={item.status === "ready" ? "success" : "warning"}>{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
