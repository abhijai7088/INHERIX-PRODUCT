"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Clock3, KeyRound, RefreshCw, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { Notice } from "@/components/inherix/notice";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import { formatDateTime } from "@/lib/records";

import { useSecurity } from "@/hooks/use-security";

function sessionIcon(deviceInfo: string | null) {
  if (/iphone|android|mobile/i.test(deviceInfo ?? "")) {
    return Smartphone;
  }

  return KeyRound;
}

export default function SecurityHardeningPage() {
  const {
    security,
    hardening,
    role,
    loading,
    rotateRecoveryCodes,
    trustDevice,
    revokeTrustedDevice,
    acknowledgeSecurityAlert,
    refresh,
  } = useSecurity();
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);
  const [rotatePending, setRotatePending] = useState(false);
  const [pendingTrustId, setPendingTrustId] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);

  const canAccessHardening = role === "CUSTOMER" || role === "ADMIN" || role === "SUPER_ADMIN";

  const trustedDevices = hardening?.trustedDevices ?? [];
  const suspiciousLogins = hardening?.suspiciousLogins ?? [];
  const recentAlerts = hardening?.recentAlerts ?? [];
  const sessions = useMemo(() => security?.sessionHistory ?? [], [security]);
  const recoveryCodes = hardening?.recoveryCodes ?? null;

  if (!loading && !canAccessHardening) {
    return (
      <Card>
        <CardContent>
          <Notice title="Hardening unavailable">
            This role does not expose the higher-trust security workspace.
          </Notice>
        </CardContent>
      </Card>
    );
  }

  async function handleRotateRecoveryCodes() {
    setMessage(null);
    setFormError(null);
    setGeneratedCodes(null);
    setRotatePending(true);

    try {
      const payload = await rotateRecoveryCodes();
      setGeneratedCodes(payload.generatedRecoveryCodes);
      setMessage("Recovery codes rotated. Store the new codes securely before leaving this page.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to rotate recovery codes.");
    } finally {
      setRotatePending(false);
    }
  }

  async function handleTrustDevice(sessionId: string, label: string | null) {
    setMessage(null);
    setFormError(null);
    setPendingTrustId(sessionId);

    try {
      await trustDevice(sessionId, { label });
      setMessage("Trusted device saved and audited.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to trust the device.");
    } finally {
      setPendingTrustId(null);
    }
  }

  async function handleRevokeTrustedDevice(sessionId: string) {
    setMessage(null);
    setFormError(null);
    setPendingRevokeId(sessionId);

    try {
      await revokeTrustedDevice(sessionId);
      setMessage("Trusted device revoked and written to the security ledger.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to revoke the trusted device.");
    } finally {
      setPendingRevokeId(null);
    }
  }

  async function handleAcknowledgeAlert(eventId: string) {
    setMessage(null);
    setFormError(null);
    setPendingAlertId(eventId);

    try {
      await acknowledgeSecurityAlert(eventId);
      setMessage("Security alert acknowledged and resolved.");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to acknowledge the alert.");
    } finally {
      setPendingAlertId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Security hardening"
        description="Higher-trust controls for recovery codes, trusted devices and suspicious login review. Every action is persisted and audited."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/dashboard/profile/security" className="inline-flex items-center gap-2 rounded-full border border-[#E5ECF5] bg-white px-4 py-2 text-sm font-semibold text-[#163B8C] transition hover:bg-[#F8FBFF]">
              Back to security
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Recovery codes", value: recoveryCodes?.remainingCount ?? 0, detail: recoveryCodes?.rotationRecommended ? "Rotation recommended" : "Freshly rotated" },
          { label: "Trusted devices", value: trustedDevices.length, detail: "Sessions marked as trusted" },
          { label: "Suspicious logins", value: suspiciousLogins.length, detail: "Unresolved login anomalies" },
          { label: "Recent alerts", value: recentAlerts.length, detail: "Active hardening signals" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="text-3xl font-semibold text-[#0F172A]">{item.value}</p>
              <p className="text-sm leading-6 text-slate-500">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card className="border-[#DCE3EC] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
            <CardContent className="space-y-5">
              <SectionHeader
                title="Recovery code vault"
                description="Generate a fresh set of one-time recovery codes for MFA recovery. The backend stores only hashed tokens."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Remaining</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{recoveryCodes?.remainingCount ?? 0}</p>
                </div>
                <div className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Expires</p>
                  <p className="mt-2 text-sm font-semibold text-[#0F172A]">{recoveryCodes?.expiresAt ? formatDateTime(recoveryCodes.expiresAt) : "Not generated yet"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void handleRotateRecoveryCodes()} disabled={rotatePending || !security?.mfaEnabled}>
                  <ShieldCheck className="h-4 w-4" />
                  {rotatePending ? "Rotating..." : "Rotate recovery codes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refresh()}>
                  <RefreshCw className="h-4 w-4" />
                  Reload profile
                </Button>
              </div>

              {security?.mfaEnabled ? null : (
                <Notice title="MFA required">
                  Enable MFA before generating recovery codes.
                </Notice>
              )}

              {generatedCodes?.length ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-amber-900">Store these codes now</p>
                      <p className="text-sm leading-6 text-amber-800">
                        They are shown only in this session. Refreshing the page will not preserve them.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {generatedCodes.map((code) => (
                          <div key={code} className="rounded-2xl border border-amber-200 bg-white px-3 py-2 font-mono text-sm text-amber-900">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <SectionHeader
                title="Trusted device registry"
                description="Promote active sessions into trusted devices or revoke the trust state at any time."
              />

              <div className="space-y-3">
                {trustedDevices.length ? (
                  trustedDevices.map((device) => {
                    const Icon = sessionIcon(device.deviceInfo);

                    return (
                      <div key={device.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-[#0F172A]">{device.deviceInfo ?? "Trusted device"}</h3>
                                <Badge variant="success">Trusted</Badge>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {device.trustLabel ?? "Unnamed trust label"} - last seen {formatDateTime(device.lastSeenAt)}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {device.browserInfo ?? "Unknown browser"} - {device.locationInfo ?? "Unknown location"}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                Trusted at {formatDateTime(device.trustedAt)}
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRevokeTrustedDevice(device.sessionId)}
                            disabled={pendingRevokeId === device.sessionId}
                          >
                            {pendingRevokeId === device.sessionId ? "Revoking..." : "Revoke trust"}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <Notice title="No trusted devices">
                    Trusted devices will appear here after a session is granted trust.
                  </Notice>
                )}
              </div>

              <div className="space-y-3">
                <SectionHeader
                  title="Promote active sessions"
                  description="Trust a session only when it represents a known device and location."
                />

                <div className="space-y-3">
                  {sessions
                    .filter((session) => session.isActive)
                    .map((session) => {
                      const Icon = sessionIcon(session.deviceInfo);
                      const alreadyTrusted = Boolean(session.trustedAt && !session.trustRevokedAt);

                      return (
                        <div key={session.id} className="rounded-[24px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-start gap-4">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-semibold text-[#0F172A]">{session.deviceInfo ?? "Unknown device"}</h3>
                                  <Badge variant={alreadyTrusted ? "success" : "secondary"}>{alreadyTrusted ? "trusted" : "untrusted"}</Badge>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {session.browserInfo ?? "Unknown browser"} - {session.locationInfo ?? "Unknown location"}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {session.ipAddress ?? "Unknown IP"} - {formatDateTime(session.createdAt)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {alreadyTrusted ? null : (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void handleTrustDevice(session.id, session.deviceInfo)}
                                  disabled={pendingTrustId === session.id}
                                >
                                  {pendingTrustId === session.id ? "Saving..." : "Trust device"}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <SectionHeader
                title="Suspicious login review"
                description="High-risk login events are surfaced here for explicit review."
              />

              <div className="space-y-3">
                {suspiciousLogins.length ? (
                  suspiciousLogins.map((alert) => (
                    <div key={alert.id} className="rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-[#0F172A]">{alert.eventType}</h3>
                            <Badge variant={alert.riskLevel === "HIGH" ? "warning" : "secondary"}>{alert.riskLevel}</Badge>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{alert.eventDescription ?? "Suspicious activity detected."}</p>
                          <p className="mt-2 text-xs text-slate-500">{formatDateTime(alert.createdAt)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleAcknowledgeAlert(alert.id)}
                          disabled={pendingAlertId === alert.id || alert.isResolved}
                        >
                          {pendingAlertId === alert.id ? "Acknowledging..." : alert.isResolved ? "Resolved" : "Acknowledge"}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Notice title="No suspicious logins">
                    No unresolved suspicious login events are currently open.
                  </Notice>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <SectionHeader
                title="Recent hardening alerts"
                description="The latest visible hardening signals from the security ledger."
              />

              <div className="space-y-3">
                {recentAlerts.length ? (
                  recentAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-[22px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-[#0F172A]">{alert.eventType}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{alert.eventDescription ?? "Security activity recorded."}</p>
                          <p className="mt-2 text-xs text-slate-500">{formatDateTime(alert.createdAt)}</p>
                        </div>
                        <Badge variant={alert.riskLevel === "HIGH" ? "warning" : alert.riskLevel === "LOW" ? "success" : "secondary"}>
                          {alert.riskLevel}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <Notice title="No alerts">
                    Recent alerts will appear here after device or recovery-code events.
                  </Notice>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Hardening posture"
                description="This workspace is intentionally separate from the basic security settings."
              />

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#163B8C]" />
                  <p className="text-sm leading-6 text-slate-600">Every hardening mutation is written to the audit trail and mirrored into security events.</p>
                </div>
                <div className="flex items-start gap-3 rounded-[22px] border border-[#E5ECF5] bg-white p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#163B8C]" />
                  <p className="text-sm leading-6 text-slate-600">Trusted-device and recovery-code actions remain role-gated in the backend and the UI.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
