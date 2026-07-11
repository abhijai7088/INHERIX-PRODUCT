"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleAlert,
  Clock3,
  Fingerprint,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  Monitor,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/inherix/badge";
import { Button } from "@/components/inherix/button";
import { Card, CardContent } from "@/components/inherix/card";
import { EmptyState } from "@/components/inherix/empty-state";
import { PageHeader } from "@/components/inherix/page-header";
import { SectionHeader } from "@/components/inherix/section-header";
import {
  getSecurityDevices,
  getSecurityEvents,
  getSecuritySessions,
  revokeSecurityDevice,
  type SecurityDeviceItem,
  type SecurityEventPayload,
  type SecuritySessionItem,
} from "@/lib/observability-api";
import { formatDateTime } from "@/lib/records";

function categoryIcon(category: string) {
  switch (category) {
    case "login":
      return ShieldCheck;
    case "device":
      return HardDrive;
    case "mfa":
      return Fingerprint;
    case "session":
      return Clock3;
    case "permission":
      return Lock;
    case "release":
      return ShieldAlert;
    case "export":
      return Shield;
    default:
      return AlertTriangle;
  }
}

function sessionIcon(deviceName: string) {
  if (/iphone|android|mobile/i.test(deviceName)) {
    return Smartphone;
  }

  if (/macbook|laptop|desktop|xps|surface/i.test(deviceName)) {
    return Laptop;
  }

  return Monitor;
}

function eventCategory(event: SecurityEventPayload["events"][number]) {
  const type = event.type.toLowerCase();
  if (type.includes("login")) return "login";
  if (type.includes("mfa")) return "mfa";
  if (type.includes("session")) return "session";
  if (type.includes("permission") || type.includes("rbac")) return "permission";
  if (type.includes("export")) return "export";
  if (type.includes("release")) return "release";
  if (type.includes("device")) return "device";
  return "device";
}

function deviceLabel(device: SecurityDeviceItem) {
  return device.deviceInfo ?? "Unknown device";
}

export default function SecurityCenterPage() {
  const [events, setEvents] = useState<SecurityEventPayload["events"]>([]);
  const [sessions, setSessions] = useState<SecuritySessionItem[]>([]);
  const [devices, setDevices] = useState<SecurityDeviceItem[]>([]);
  const [scope, setScope] = useState<"own" | "all">("own");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadSecurityData = useCallback(async (mounted: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [eventPayload, sessionPayload, devicePayload] = await Promise.all([
        getSecurityEvents(100),
        getSecuritySessions(100),
        getSecurityDevices(100),
      ]);

      if (mounted) {
        setEvents(eventPayload.events ?? []);
        setSessions(sessionPayload.sessions ?? []);
        setDevices(devicePayload.devices ?? []);
        setScope(eventPayload.scope ?? sessionPayload.scope ?? devicePayload.scope ?? "own");
      }
    } catch {
      if (mounted) {
        setEvents([]);
        setSessions([]);
        setDevices([]);
        setError("Unable to load the live security ledger right now.");
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void loadSecurityData(mounted);

    return () => {
      mounted = false;
    };
  }, [loadSecurityData]);

  const score = useMemo(() => {
    const highRiskEvents = events.filter((event) => event.severity === "high" || event.severity === "critical").length;
    const unresolvedEvents = events.filter((event) => event.outcome !== "success").length;
    const revokedSessions = sessions.filter((session) => session.revokedAt).length;
    const activeDevices = devices.filter((device) => device.isActive).length;
    const penalties = highRiskEvents * 7 + unresolvedEvents * 2 + revokedSessions * 2 + Math.max(activeDevices - 1, 0);

    return Math.max(68, 100 - penalties);
  }, [devices, events, sessions]);

  const stats = useMemo(
    () => ({
      incidents: events.length,
      open: events.filter((event) => event.outcome !== "success").length,
      devices: devices.length,
      activeSessions: sessions.filter((session) => session.isActive).length,
    }),
    [devices, events, sessions]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Security Center"
          title="Security Center"
          description="Account protection, device trust and suspicious activity monitoring for the continuity vault."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading security ledger...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !events.length && !sessions.length && !devices.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Security Center"
          title="Security Center"
          description="Account protection, device trust and suspicious activity monitoring for the continuity vault."
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

  async function handleRevokeDevice(deviceId: string) {
    setRefreshingId(deviceId);
    setActionMessage(null);

    try {
      const result = await revokeSecurityDevice(deviceId);
      setActionMessage(`Revoked ${result.revokedSessionCount} active session${result.revokedSessionCount === 1 ? "" : "s"} for that device.`);
      await loadSecurityData(true);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Unable to revoke the device.");
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security Center"
        title="Security Center"
        description="Account protection, device trust and suspicious activity monitoring for the continuity vault. The view is powered by the live security ledger and respects role boundaries."
        actions={
          <Button variant="outline" size="sm" onClick={() => void loadSecurityData(true)}>
            <RefreshCw className="h-4 w-4" />
            Refresh ledger
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Security score", value: score, icon: ShieldCheck, suffix: "/100" },
          { label: "Devices", value: stats.devices, icon: HardDrive },
          { label: "Open incidents", value: stats.open, icon: AlertTriangle },
          { label: "Active sessions", value: stats.activeSessions, icon: Clock3 },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label}>
              <CardContent className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
                    {item.value}
                    {item.suffix ? <span className="text-lg font-medium text-slate-400">{item.suffix}</span> : null}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {actionMessage ? (
        <Card className="border-[#D8E6FF] bg-[#F5F8FF]">
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Security action completed</p>
              <p className="text-sm leading-6 text-slate-500">{actionMessage}</p>
            </div>
            <Badge variant="success">Audit recorded</Badge>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Password policy",
                  text: "Password rotations are captured as audit events without exposing the secret value.",
                  icon: KeyRound,
                  tone: "success" as const,
                },
                {
                  title: "Device trust",
                  text: "Login devices are grouped from the live session ledger and can be revoked when risk appears.",
                  icon: HardDrive,
                  tone: "warning" as const,
                },
                {
                  title: "Session monitoring",
                  text: "Active and idle sessions are tracked by device, location and trust state.",
                  icon: Monitor,
                  tone: "secondary" as const,
                },
                {
                  title: "Threat detection",
                  text: "Failed logins, anomalous sessions and revocations are summarized in the live security feed.",
                  icon: ShieldAlert,
                  tone: "destructive" as const,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-[24px] border border-[#E5ECF5] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant={item.tone}>{item.tone}</Badge>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-[#0F172A]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Security scope</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">{scope === "all" ? "Admin security ledger" : "Own security ledger"}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                The backend controls which events, devices and sessions are visible for the current role.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#DCE3EC] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Protection layer</p>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">MFA, device trust and session review</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Passwords, raw tokens and document content are never displayed in this surface.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Security events"
              description="Suspicious activity, access changes and approvals are recorded with minimum necessary metadata."
            />

            <div className="space-y-4">
              {loading ? (
                <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                  Loading security events...
                </div>
              ) : events.length ? (
                events.map((event) => {
                  const Icon = categoryIcon(eventCategory(event));

                  return (
                    <div key={event.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-[#0F172A]">{event.title}</h3>
                              <Badge
                                variant={
                                  event.outcome === "success"
                                    ? "success"
                                    : event.outcome === "warning"
                                      ? "warning"
                                      : event.outcome === "failure"
                                        ? "destructive"
                                        : "secondary"
                                }
                              >
                                {event.outcome}
                              </Badge>
                              <Badge
                                variant={
                                  event.severity === "critical"
                                    ? "destructive"
                                    : event.severity === "high"
                                      ? "warning"
                                      : event.severity === "medium"
                                        ? "secondary"
                                        : "default"
                                }
                              >
                                {event.severity}
                              </Badge>
                            </div>

                            <p className="max-w-3xl text-sm leading-6 text-slate-500">{event.summary}</p>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{event.actor}</span>
                              <span aria-hidden="true">•</span>
                              <span>{event.location}</span>
                              <span aria-hidden="true">•</span>
                              <span>{event.device}</span>
                            </div>

                            <p className="text-sm leading-6 text-slate-600">
                              {event.outcome === "success" ? "Contained automatically." : "Review required."}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                          <Clock3 className="h-4 w-4 text-[#163B8C]" />
                          {formatDateTime(event.occurredAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="No security events match this scope"
                  description="Try a different search term or wait for a new session or login event to appear."
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <SectionHeader
                title="Login devices"
                description="Device profiles are derived from the live session ledger. Revoking a device ends all active sessions that match the same trust signature."
              />

              <div className="space-y-4">
                {loading ? (
                  <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-sm text-slate-500">
                    Loading device ledger...
                  </div>
                ) : devices.length ? (
                  devices.map((device) => {
                    const Icon = sessionIcon(deviceLabel(device));
                    const revoking = refreshingId === device.id;

                    return (
                      <div key={device.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                              <Icon className="h-5 w-5" />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-[#0F172A]">{deviceLabel(device)}</h3>
                                <Badge variant={device.isActive ? "success" : "secondary"}>
                                  {device.isActive ? "active" : "revoked"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {device.fullName} • {device.email}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {device.browserInfo ?? "Unknown browser"} • {device.locationInfo ?? "Unknown location"}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                Last login {formatDateTime(device.lastLoginAt)} • {device.activeSessionCount} active session{device.activeSessionCount === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRevokeDevice(device.id)}
                            disabled={revoking || !device.isActive}
                          >
                            {revoking ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Revoking
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="h-4 w-4" />
                                Revoke
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <p>First seen {formatDateTime(device.firstSeenAt)}</p>
                          <p>Total sessions {device.totalSessionCount}</p>
                          <p>Device ID {device.id.slice(0, 12)}…</p>
                          <p>{device.ipAddress ?? "No IP recorded"}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No devices match this scope"
                    description="The device ledger will appear when authenticated users generate sessions on the platform."
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <SectionHeader
                title="Device and session monitoring"
                description="The current session ledger is visible only within the selected role boundary."
              />

              <div className="space-y-4">
                {sessions.length ? (
                  sessions.map((session) => {
                    const Icon = sessionIcon(session.deviceInfo ?? "desktop");

                    return (
                      <div key={session.id} className="rounded-[24px] border border-[#E5ECF5] bg-white p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#163B8C]">
                              <Icon className="h-5 w-5" />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-[#0F172A]">{session.fullName}</h3>
                                <Badge variant={session.isActive ? "success" : "secondary"}>{session.isActive ? "active" : "inactive"}</Badge>
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {session.email} • {session.role}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {session.locationInfo ?? "Unknown location"} • {session.ipAddress ?? "Unknown IP"}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                {session.browserInfo ?? "Unknown browser"} • {session.deviceInfo ?? "Unknown device"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{session.isActive ? "Current" : "Recent"}</p>
                            <p className="mt-2 text-sm font-semibold text-[#0F172A]">{session.isActive ? "Trusted" : "Review"}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <p>Started {formatDateTime(session.createdAt)}</p>
                          <p>Expires {formatDateTime(session.expiresAt)}</p>
                          <p>{session.rotatedAt ? `Rotated ${formatDateTime(session.rotatedAt)}` : "No rotation recorded"}</p>
                          <p>{session.revokedAt ? `Revoked ${formatDateTime(session.revokedAt)}` : "Available for review only"}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No sessions match this scope"
                    description="The session ledger will appear here once users authenticate or rotate their access."
                  />
                )}
              </div>

              <div className="rounded-[24px] border border-[#E5ECF5] bg-[#FAFCFF] p-4">
                <div className="flex items-start gap-3">
                  <UserCheck className="mt-0.5 h-5 w-5 text-[#163B8C]" />
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">Read-only monitoring</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Session and security data are view-only unless the product explicitly exposes a remediation control.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
