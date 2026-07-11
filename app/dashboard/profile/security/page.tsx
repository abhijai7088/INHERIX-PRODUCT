"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Clock3,
  Fingerprint,
  HardDrive,
  KeyRound,
  Laptop,
  Monitor,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Input } from "@/components/inherix/input";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { FieldHint, FieldLabel, FormField } from "@/components/inherix/field";
import { formatDateTime } from "@/lib/records";

import { useSecurity } from "@/hooks/use-security";

function sessionIcon(deviceInfo: string | null) {
  if (/iphone|android|mobile/i.test(deviceInfo ?? "")) {
    return Smartphone;
  }

  if (/macbook|laptop|desktop|xps|surface/i.test(deviceInfo ?? "")) {
    return Laptop;
  }

  return Monitor;
}

export default function SecurityProfilePage() {
  const {
    privacy,
    security,
    hardening,
    role,
    loading,
    changePassword,
    setMfaEnabled,
    revokeSession,
    revokeAllSessions,
    refresh,
    isSectionVisible,
    getSection,
  } = useSecurity();
  const section = getSection("security");
  const isVisible = isSectionVisible("security");
  const [isPending, startTransition] = useTransition();
  const [mfaPending, setMfaPending] = useState(false);
  const [revokePendingId, setRevokePendingId] = useState<string | null>(null);
  const [revokeAllPending, setRevokeAllPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const activeMfa = security?.mfaEnabled ?? false;
  const trustedDeviceTrackingEnabled = security?.trustedDeviceTrackingEnabled ?? privacy?.preferences.allowTrustedDeviceTracking ?? false;

  const sessionHistory = useMemo(() => security?.sessionHistory ?? [], [security]);
  const deviceHistory = useMemo(() => security?.deviceHistory ?? [], [security]);
  const loginHistory = useMemo(() => security?.loginHistory ?? [], [security]);
  const recentEvents = useMemo(() => security?.recentSecurityEvents ?? [], [security]);

  const sessionCount = security?.activeSessionCount ?? 0;
  const totalSessionCount = security?.totalSessionCount ?? 0;
  const canAccessHardening = role === "CUSTOMER" || role === "ADMIN" || role === "SUPER_ADMIN";
  const hardeningSummary = hardening;

  if (!loading && !isVisible) {
    return (
      <Card>
        <CardContent>
          <Notice title="Security section unavailable">
            {section?.reason ?? "This section is not available for the current role."}
          </Notice>
        </CardContent>
      </Card>
    );
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setFormError(null);

    if (!currentPassword || !newPassword) {
      setFormError("Both password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("The new password confirmation does not match.");
      return;
    }

    startTransition(async () => {
      try {
        await changePassword({
          currentPassword,
          newPassword,
        });
        setMessage("Password changed and all active sessions were revoked.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (caught) {
        setFormError(caught instanceof Error ? caught.message : "Unable to change the password.");
      }
    });
  }

  async function handleToggleMfa(nextValue: boolean) {
    setMfaPending(true);
    setMessage(null);
    setFormError(null);

    try {
      await setMfaEnabled(nextValue);
      setMessage(nextValue ? "MFA was enabled and audited." : "MFA was disabled and audited.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to update MFA state.");
    } finally {
      setMfaPending(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokePendingId(sessionId);
    setMessage(null);
    setFormError(null);

    try {
      await revokeSession(sessionId);
      setMessage("The session was revoked and the action was audited.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to revoke the session.");
    } finally {
      setRevokePendingId(null);
    }
  }

  async function handleRevokeAllSessions() {
    const confirmed = window.confirm("Revoke all active sessions for this account?");
    if (!confirmed) {
      return;
    }

    setRevokeAllPending(true);
    setMessage(null);
    setFormError(null);

    try {
      await revokeAllSessions();
      setMessage("All active sessions were revoked and written to the audit trail.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to revoke all sessions.");
    } finally {
      setRevokeAllPending(false);
    }
  }

  const summaryCards = [
    { label: "MFA", value: activeMfa ? "Enabled" : "Disabled", icon: Fingerprint },
    { label: "Active sessions", value: sessionCount, icon: Clock3 },
    { label: "Devices", value: deviceHistory.length, icon: HardDrive },
    { label: "Login events", value: loginHistory.length, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Security"
        description="Manage password updates, MFA, sessions and device trust from one audited backend workflow."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {message ? (
        <Notice title="Saved">
          {message}
        </Notice>
      ) : null}

      {formError ? (
        <Notice title="Unable to save" className="border-red-200 bg-red-50 text-red-700">
          {formError}
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {summaryCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="border-[#E5ECF5] bg-white">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{item.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {canAccessHardening ? (
        <Card className="border-[#DCE3EC] bg-[linear-gradient(135deg,#0F172A_0%,#163B8C_54%,#2F66D8_100%)] text-white">
          <CardContent className="grid gap-5 2xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Higher-trust hardening</p>
              <h2 className="text-2xl font-semibold tracking-tight">Recovery codes, trusted devices and security alerts.</h2>
              <p className="max-w-2xl text-sm leading-6 text-white/80">
                Open the hardening workspace to rotate recovery codes, manage trusted devices and acknowledge suspicious login signals from the same audited backend ledger.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/dashboard/profile/security/hardening" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#163B8C] transition hover:bg-[#EEF4FF]">
                  Open hardening
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Button variant="outline" size="sm" onClick={() => void refresh()} className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  <RefreshCw className="h-4 w-4" />
                  Refresh state
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/65">Recovery codes</p>
                <p className="mt-2 text-3xl font-semibold">{hardeningSummary?.recoveryCodes.remainingCount ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-white/75">Available codes ready for one-time recovery.</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/65">Trusted devices</p>
                <p className="mt-2 text-3xl font-semibold">{hardeningSummary?.trustedDevices.length ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-white/75">Devices granted trust through the profile aggregate.</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/65">Suspicious logins</p>
                <p className="mt-2 text-3xl font-semibold">{hardeningSummary?.suspiciousLogins.length ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-white/75">Unresolved login anomalies surfaced from the backend ledger.</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/65">Alerts</p>
                <p className="mt-2 text-3xl font-semibold">{hardeningSummary?.recentAlerts.length ?? 0}</p>
                <p className="mt-2 text-sm leading-6 text-white/75">Recent hardening alerts waiting on review or acknowledgment.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <SectionHeader
              title="Protection layer"
              description="Password, MFA and trusted-device posture are all backed by the profile aggregate."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <Badge variant="success">Audited</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#0F172A]">Password control</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Password changes immediately revoke active sessions and write security events.
                </p>
              </div>

              <div className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <Badge variant={activeMfa ? "success" : "warning"}>{activeMfa ? "On" : "Off"}</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#0F172A]">MFA posture</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  MFA state is stored in the backend and can be switched without leaving this page.
                </p>
              </div>

              <div className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <Badge variant={trustedDeviceTrackingEnabled ? "success" : "secondary"}>{trustedDeviceTrackingEnabled ? "Tracked" : "Off"}</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#0F172A]">Trusted devices</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Device trust is controlled by the privacy aggregate and reflected here for quick review.
                </p>
              </div>

              <div className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <Badge variant="warning">Sensitive</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#0F172A]">Session revocation</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Revoke a single session or all active sessions from the same audited workflow.
                </p>
              </div>
            </div>

            <Card className="border-[#E5ECF5] bg-white">
              <CardContent className="space-y-5">
                <SectionHeader
                  title="Change password"
                  description="This form is fully backend-driven and keeps the secret out of the UI after submission."
                />

                <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField>
                      <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                      />
                    </FormField>

                    <FormField>
                      <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                    </FormField>

                    <FormField>
                      <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                    </FormField>
                  </div>

                  <FieldHint>Passwords are never persisted in the browser after the mutation returns.</FieldHint>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={isPending}>
                      <ShieldCheck className="h-4 w-4" />
                      {isPending ? "Saving..." : "Change password"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleRevokeAllSessions} disabled={revokeAllPending}>
                      <ShieldAlert className="h-4 w-4" />
                      {revokeAllPending ? "Revoking..." : "Revoke all sessions"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void refresh()}>
                      <RefreshCw className="h-4 w-4" />
                      Reload profile
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-[#E5ECF5] bg-white">
              <CardContent className="space-y-4">
                <SectionHeader
                  title="MFA and trust"
                  description="MFA can be toggled here. Trusted device tracking is managed in the privacy settings."
                />

                <div className="rounded-[24px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">Multi-factor authentication</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {activeMfa ? "MFA is enabled for this account." : "MFA is currently disabled for this account."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={activeMfa ? "outline" : "primary"}
                      size="sm"
                      onClick={() => void handleToggleMfa(!activeMfa)}
                      disabled={mfaPending}
                    >
                      <Fingerprint className="h-4 w-4" />
                      {mfaPending ? "Updating..." : activeMfa ? "Disable MFA" : "Enable MFA"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">Trusted device tracking</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {trustedDeviceTrackingEnabled
                          ? "Trusted device tracking is enabled in privacy settings."
                          : "Trusted device tracking is disabled in privacy settings."}
                      </p>
                    </div>
                    <Link href="/dashboard/profile/privacy" className="text-sm font-semibold text-[#163B8C] hover:underline">
                      Open privacy
                    </Link>
                  </div>
                </div>

                <Notice title="Audit trail">
                  MFA toggles, password changes and session revocations all emit audit records and security events.
                </Notice>
              </CardContent>
            </Card>

            <Card className="border-[#E5ECF5] bg-white">
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Session ledger"
                  description="Every session, active or revoked, is taken directly from the backend ledger."
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Total sessions", value: totalSessionCount },
                    { label: "Active now", value: sessionCount },
                    { label: "Login events", value: loginHistory.length },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {sessionHistory.length ? (
                    sessionHistory.map((session) => {
                      const Icon = sessionIcon(session.deviceInfo);
                      const active = session.isActive && !session.revokedAt;

                      return (
                        <div key={session.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                                <Icon className="h-5 w-5" />
                              </div>

                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-[#0F172A]">{session.deviceInfo ?? "Unknown device"}</h3>
                                  <Badge variant={active ? "success" : "secondary"}>{active ? "active" : "inactive"}</Badge>
                                </div>
                                <p className="text-sm leading-6 text-slate-500">
                                  {session.fullName} - {session.email} - {session.role}
                                </p>
                                <p className="text-sm leading-6 text-slate-500">
                                  {session.browserInfo ?? "Unknown browser"} - {session.locationInfo ?? "Unknown location"}
                                </p>
                                <p className="text-sm leading-6 text-slate-500">
                                  {session.ipAddress ?? "Unknown IP"} - Started {formatDateTime(session.createdAt)}
                                </p>
                                <p className="text-sm leading-6 text-slate-500">
                                  {session.revokedAt ? `Revoked ${formatDateTime(session.revokedAt)}` : `Expires ${formatDateTime(session.expiresAt)}`}
                                </p>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleRevokeSession(session.id)}
                              disabled={revokePendingId === session.id || !active}
                            >
                              {revokePendingId === session.id ? "Revoking..." : "Revoke"}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Notice title="No sessions available">
                      Session details will appear here once the account authenticates on this device.
                    </Notice>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E5ECF5] bg-white">
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Device history"
                  description="Devices are grouped from the login ledger so you can review repeated sign-ins and trust patterns."
                />

                <div className="space-y-3">
                  {deviceHistory.length ? (
                    deviceHistory.map((device) => {
                      const Icon = sessionIcon(device.deviceInfo);

                      return (
                        <div key={device.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                                <Icon className="h-5 w-5" />
                              </div>

                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-[#0F172A]">{device.deviceInfo ?? "Unknown device"}</h3>
                                  <Badge variant={device.isActive ? "success" : "secondary"}>{device.isActive ? "active" : "revoked"}</Badge>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {device.fullName} - {device.email} - {device.role}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {device.browserInfo ?? "Unknown browser"} - {device.locationInfo ?? "Unknown location"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                            <p>First seen {formatDateTime(device.firstSeenAt)}</p>
                            <p>Last login {formatDateTime(device.lastLoginAt)}</p>
                            <p>Active sessions {device.activeSessionCount}</p>
                            <p>Total sessions {device.totalSessionCount}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Notice title="No devices yet">
                      Device history will appear once this account has more than one authenticated session.
                    </Notice>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E5ECF5] bg-white">
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Login history"
                  description="Authentication-related events are filtered from the live security ledger."
                />

                <div className="space-y-3">
                  {loginHistory.length ? (
                    loginHistory.map((event) => (
                      <div key={event.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-[#0F172A]">{event.eventType}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{event.eventDescription ?? "Recorded authentication activity."}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {event.actorName ?? "System"}
                              {event.actorEmail ? ` - ${event.actorEmail}` : ""} - {formatDateTime(event.createdAt)}
                            </p>
                          </div>
                          <Badge variant={event.riskLevel === "HIGH" ? "warning" : event.riskLevel === "LOW" ? "success" : "secondary"}>
                            {event.riskLevel}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Notice title="No login history">
                      Login-related events will appear here after successful sign-in, token refresh or other auth ledger activity.
                    </Notice>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E5ECF5] bg-white">
              <CardContent className="space-y-4">
                <SectionHeader
                  title="Recent security events"
                  description="The latest security activity tied to this profile center."
                />

                <div className="space-y-3">
                  {recentEvents.length ? (
                    recentEvents.map((event) => (
                      <div key={event.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-[#0F172A]">{event.eventType}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500">{event.eventDescription ?? "Recorded security activity."}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {event.actorName ?? "System"}
                              {event.actorEmail ? ` - ${event.actorEmail}` : ""} - {formatDateTime(event.createdAt)}
                            </p>
                          </div>
                          <Badge variant={event.riskLevel === "HIGH" ? "warning" : event.riskLevel === "LOW" ? "success" : "secondary"}>
                            {event.riskLevel}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Notice title="No security events yet">
                      Security activity will appear here after the first profile mutation or session event.
                    </Notice>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
