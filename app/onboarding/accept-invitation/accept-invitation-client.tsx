"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/inherix/button";
import { Notice } from "@/components/inherix/notice";
import { clearAccessToken } from "@/lib/auth-state";
import { BackendApiError } from "@/lib/backend-api";
import { acceptNomineeInvitation, loadNomineeInvitationContext, resendExpiredNomineeInvitation } from "@/lib/nominees";
import { setAccessToken } from "@/lib/auth-state";
import { formatDateTime } from "@/lib/records";
import { getCurrentUser } from "@/lib/trigger-api";

type InvitationContext = {
  fullName: string;
  email: string | null;
  expiresAt: string | null;
  isExpired: boolean;
};

export default function AcceptInvitationClient({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => (token ? "" : "The invitation link is missing its token."));
  const [success, setSuccess] = useState(false);
  const [wrongUserState, setWrongUserState] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [invitationContext, setInvitationContext] = useState<InvitationContext | null>(null);
  const [currentAccountEmail, setCurrentAccountEmail] = useState<string | null>(null);
  const [autoAccepting, setAutoAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const loadInvitationContext = async () => {
      try {
        const payload = await loadNomineeInvitationContext(token);
        if (!cancelled) {
          setInvitationContext(payload.invitation);
        }
      } catch {
        // The main accept flow will show the issue if the token is invalid or the backend is unavailable.
      }
    };

    void loadInvitationContext();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentAccount = async () => {
      try {
        const me = await getCurrentUser();
        if (!cancelled) {
          setCurrentAccountEmail(me.user.email);
        }
      } catch {
        if (!cancelled) {
          setCurrentAccountEmail(null);
        }
      }
    };

    void loadCurrentAccount();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!invitationContext?.email || !currentAccountEmail) {
      return;
    }

    if (invitationContext.email.toLowerCase() !== currentAccountEmail.toLowerCase()) {
      setWrongUserState(true);
      setError("This invitation belongs to a different email address. Sign out and continue with the invited account.");
    }
  }, [currentAccountEmail, invitationContext]);

  useEffect(() => {
    if (!token || success || loading || autoAccepting || wrongUserState) {
      return;
    }

    const invitationEmail = invitationContext?.email?.toLowerCase();
    if (!invitationEmail || !currentAccountEmail) {
      return;
    }

    if (invitationEmail !== currentAccountEmail.toLowerCase()) {
      return;
    }

    setAutoAccepting(true);
    void handleAccept().finally(() => {
      setAutoAccepting(false);
    });
  }, [autoAccepting, currentAccountEmail, handleAccept, invitationContext?.email, loading, success, token, wrongUserState]);

  async function handleLogoutAndReturn() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      clearAccessToken();
      setWrongUserState(false);
      router.replace(`/onboarding/login?next=${encodeURIComponent(`/onboarding/accept-invitation?token=${token}`)}`);
    }
  }

  async function handleResendInvitation() {
    if (!token) {
      return;
    }

    setResending(true);
    setResendSuccess("");
    setError("");

    try {
      const payload = await resendExpiredNomineeInvitation(token);
      const resend = payload && typeof payload === "object" && "resend" in payload
        ? (payload as { resend?: { expiresAt: string | null } }).resend
        : undefined;

      setInvitationContext((current) =>
        current
          ? {
              ...current,
              expiresAt: resend?.expiresAt ?? current.expiresAt,
              isExpired: false,
            }
          : current
      );
      setResendSuccess("A fresh invitation has been sent to the nominee email address.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Unable to resend the invitation.");
    } finally {
      setResending(false);
    }
  }

  async function handleAccept() {
    if (!token) {
      setError("The invitation link is missing its token.");
      return;
    }

    setLoading(true);
    setError("");
    setWrongUserState(false);

    try {
      const payload = await acceptNomineeInvitation(token);

      if (payload.accessToken) {
        setAccessToken(payload.accessToken);
      }

      setSuccess(true);
      window.location.assign(
        `/auth/session?token=${encodeURIComponent(payload.accessToken ?? "")}&next=${encodeURIComponent(payload.nextPath)}`
      );
    } catch (acceptError) {
      if (acceptError instanceof BackendApiError && acceptError.statusCode === 401) {
        router.push(`/onboarding/login?next=${encodeURIComponent(`/onboarding/accept-invitation?token=${token}`)}`);
        return;
      }
      if (acceptError instanceof BackendApiError && acceptError.statusCode === 403) {
        setWrongUserState(true);
        setError("This invitation belongs to a different email address. Sign out and use the invited email, or create the account for the invited person first.");
        return;
      }
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept this invitation.");
    } finally {
      setLoading(false);
    }
  }

  const createAccountHref = `/onboarding/create-account?token=${encodeURIComponent(token)}&next=${encodeURIComponent(`/onboarding/accept-invitation?token=${token}`)}`;

  return (
    <OnboardingShell
      badge="Invitation"
      title="Accept your nominee invitation."
      subtitle="Confirm the invitation token to activate nominee access with the correct scoped permissions."
      highlight="Nominee access stays limited to the owner-approved release process."
      primaryImage={{
        src: "/onboarding-showcase/welcome-secondary-2.jpg",
        alt: "Nominee invitation and controlled access concept",
        caption: "Invitation flow",
      }}
    >
      <div className="flex flex-col gap-8">
        <BrandHeader />

        <div className="max-w-[620px] space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">
              Invitation accepted here
            </p>
            <h2 className="text-[clamp(2.1rem,3.5vw,3.3rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              {success ? "Your nominee access is being prepared." : "Confirm your invitation and continue."}
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              We will confirm your invitation token and activate your nominee account after you sign in with the invited email.
            </p>
          </div>

          {token ? <Notice title="Invitation link detected">This invitation is time-limited and can only be used once.</Notice> : null}
          {invitationContext ? (
            <Notice title="Invited nominee">
              <div className="space-y-1">
                <p className="text-base font-semibold text-[#0F172A]">{invitationContext.fullName}</p>
                <p className="text-sm text-slate-600">{invitationContext.email ?? "No email on file"}</p>
                {invitationContext.expiresAt ? (
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    {invitationContext.isExpired ? "Expired" : "Expires"} {formatDateTime(invitationContext.expiresAt)}
                  </p>
                ) : null}
              </div>
            </Notice>
          ) : null}
          {resendSuccess ? <Notice title="Invitation resent">{resendSuccess}</Notice> : null}
          {error ? <Notice title="Invitation issue">{error}</Notice> : null}

          {wrongUserState ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-900">Wrong account detected</p>
              <p className="mt-2 text-sm leading-6 text-amber-900/80">
                This invitation is tied to a different email address, so we will not activate it from the current account.
              </p>
              <div className="mt-4 rounded-[20px] border border-amber-200 bg-white/70 p-4 text-sm text-amber-900">
                <p className="font-semibold">Invitation email</p>
                <p className="mt-1">{invitationContext?.email ?? "Not available"}</p>
                <p className="mt-3 font-semibold">Signed-in account</p>
                <p className="mt-1">{currentAccountEmail ?? "Not available"}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleLogoutAndReturn()}
                  className="h-11 rounded-2xl bg-amber-600 px-4 text-sm font-medium text-white transition hover:bg-amber-700"
                >
                  Sign out and continue invite
                </button>
                <Link
                  href={`/onboarding/login?next=${encodeURIComponent(`/onboarding/accept-invitation?token=${token}`)}`}
                  className="inline-flex h-11 items-center rounded-2xl border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 transition hover:bg-amber-50"
                >
                  Go to login
                </Link>
                <Link
                  href={createAccountHref}
                  className="inline-flex h-11 items-center rounded-2xl border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 transition hover:bg-amber-50"
                >
                  I need to create it
                </Link>
              </div>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-[#DCE3EC] bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-[#163B8B]" />
              <p className="text-sm leading-6 text-[#64748B]">
                You will not gain unrestricted vault browsing. Only owner-approved access rules and released documents are available after acceptance.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border border-[#DCE3EC] bg-[#EEF4FF]">
            <UserPlus className="h-14 w-14 text-[#163B8B]" />
          </div>

          <Button
            type="button"
            onClick={handleAccept}
            className="h-14 w-full rounded-2xl"
            disabled={loading || !token}
          >
            <span className="flex-1 text-center">{loading ? "Accepting..." : "Accept invitation"}</span>
          </Button>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/onboarding/login?next=${encodeURIComponent(`/onboarding/accept-invitation?token=${token}`)}`}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm font-medium text-[#2453A6] transition hover:bg-[#F8FAFC]"
            >
              I already have this account
            </Link>
            <Link
              href={createAccountHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#163B8B] px-4 text-sm font-medium text-white transition hover:bg-[#12306f]"
            >
              I need to create it
            </Link>
          </div>

          {invitationContext?.isExpired ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">This invitation has expired.</p>
              <p className="mt-2 text-sm leading-6 text-amber-900/80">
                The nominee can create the invited account, but acceptance will require a fresh invitation from the owner.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleResendInvitation()}
                  disabled={resending}
                  className="h-11 rounded-2xl bg-amber-600 px-4 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resending ? "Resending..." : "Resend invitation"}
                </button>
                <Link
                  href={createAccountHref}
                  className="inline-flex h-11 items-center rounded-2xl border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 transition hover:bg-amber-50"
                >
                  Create invited account
                </Link>
              </div>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4 text-sm leading-6 text-[#4B5563]">
            If you were invited to this platform, use the email address that received the invitation. After registration and verification, sign in again and we will return you to this page automatically.
          </div>

          <button
            type="button"
            onClick={() => router.push("/onboarding/login")}
            className="w-full text-[15px] text-[#64748B]"
          >
            Back to login
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
