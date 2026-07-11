"use client";

import { useState } from "react";
import { useEffect } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import { Button } from "@/components/inherix/button";
import { Input } from "@/components/inherix/input";
import { Notice } from "@/components/inherix/notice";
import { BackendApiError } from "@/lib/backend-api";
import { backendJsonFetch, setAccessToken } from "@/lib/auth-state";
import { loadNomineeInvitationContext } from "@/lib/nominees";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

export default function LoginScreen() {
  const [search] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mfaPreviewCode, setMfaPreviewCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"email" | "password" | "verificationCode", string>>>({});
  const [touched, setTouched] = useState<Partial<Record<"email" | "password" | "verificationCode", boolean>>>({});
  const [showCredentialForm, setShowCredentialForm] = useState(true);
  const [invitationContext, setInvitationContext] = useState<{
    fullName: string;
    email: string | null;
    expiresAt: string | null;
    isExpired: boolean;
    invitationStatus: string;
  } | null>(null);

  const searchParams = new URLSearchParams(search);
  const loginMode = searchParams.get("mode");
  const nextPath = searchParams.get("next");
  const invitationTokenFromNext = nextPath?.includes("/onboarding/accept-invitation")
    ? new URLSearchParams((nextPath?.split("?")[1] ?? "")).get("token")
    : null;
  const invitationTokenFromQuery = searchParams.get("token");
  const invitationToken = invitationTokenFromNext ?? invitationTokenFromQuery;
  const invitationFlowActive = Boolean(loginMode === "nominee" || invitationToken || nextPath?.startsWith("/onboarding/accept-invitation"));

  const validateField = (
    field: "email" | "password" | "verificationCode",
    value: string,
    currentMfaRequired = mfaRequired
  ) => {
    if (field === "email") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? "" : "Enter a valid email address.";
    }

    if (field === "password") {
      return value.trim() ? "" : "Password is required.";
    }

    const normalized = value.replace(/\D/g, "");
    return currentMfaRequired && normalized.length === 6 ? "" : "Enter the 6-digit verification code.";
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<"email" | "password" | "verificationCode", string>> = {
      email: validateField("email", email),
      password: mfaRequired ? undefined : validateField("password", password),
      verificationCode: mfaRequired ? validateField("verificationCode", verificationCode) : undefined,
    };

    for (const key of Object.keys(nextErrors) as Array<"email" | "password" | "verificationCode">) {
      if (!nextErrors[key]) {
        delete nextErrors[key];
      }
    }

    setFieldErrors(nextErrors);
    setTouched({ email: true, password: true, verificationCode: true });
    return nextErrors;
  };

  const handleChange = (field: "email" | "password" | "verificationCode", value: string) => {
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    if (field === "verificationCode") setVerificationCode(value.replace(/\D/g, "").slice(0, 6));

    const nextValue = value;
    const nextErrors = { ...fieldErrors };
    nextErrors[field] = validateField(field, nextValue) || undefined;

    if (field === "password" && !mfaRequired) {
      nextErrors.password = validateField("password", nextValue) || undefined;
    }

    if (field === "verificationCode") {
      nextErrors.verificationCode = validateField("verificationCode", nextValue) || undefined;
    }

    setFieldErrors(nextErrors);
  };

  const handleBlur = (field: "email" | "password" | "verificationCode") => {
    setTouched((current) => ({ ...current, [field]: true }));
    const value = field === "email" ? email : field === "password" ? password : verificationCode;
    setFieldErrors((current) => ({
      ...current,
      [field]: validateField(field, value) || undefined,
    }));
  };

  const createAccountHref = (() => {
    if (!invitationFlowActive) {
      return "/onboarding/create-account";
    }

    const params = new URLSearchParams();
    if (invitationToken) {
      params.set("token", invitationToken);
    } else if (email.trim()) {
      params.set("email", email.trim());
    }
    params.set("next", nextPath ?? `/onboarding/accept-invitation${invitationToken ? `?token=${encodeURIComponent(invitationToken)}` : ""}`);
    return `/onboarding/create-account?${params.toString()}`;
  })();

  useEffect(() => {
    setShowCredentialForm(!invitationFlowActive);
    if (invitationFlowActive) {
      setMfaRequired(false);
    }
  }, [invitationFlowActive]);

  useEffect(() => {
    if (!invitationToken) {
      setInvitationContext(null);
      return;
    }

    let cancelled = false;

    const loadInvitationContext = async () => {
      try {
        const payload = await loadNomineeInvitationContext(invitationToken);
        if (cancelled) {
          return;
        }

        setInvitationContext(payload.invitation);
        if (payload.invitation.email && !email) {
          setEmail(payload.invitation.email);
        }
      } catch {
        if (!cancelled) {
          setInvitationContext(null);
        }
      }
    };

    void loadInvitationContext();

    return () => {
      cancelled = true;
    };
  }, [email, invitationToken]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const validation = validateForm();
    if (Object.keys(validation).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = mfaRequired ? "/auth/mfa/verify" : "/auth/login";
      const body = mfaRequired
        ? {
            email,
            code: verificationCode,
            invitationToken,
          }
        : {
            email,
            password,
            invitationToken,
          };

      const response = await backendJsonFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (response.status === 202 && payload?.data?.mfaRequired) {
        const previewCode = typeof payload?.data?.mfaCodePreview === "string" ? payload.data.mfaCodePreview : "";
        setMfaPreviewCode(previewCode);
        if (previewCode) {
          const verifyResponse = await backendJsonFetch("/auth/mfa/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              code: previewCode,
              invitationToken,
            }),
          });

          const verifyPayload = await verifyResponse.json().catch(() => null);

          if (!verifyResponse.ok) {
            if (verifyResponse.status === 401 || verifyResponse.status === 403) {
              setMfaRequired(true);
              setVerificationCode(previewCode);
              setError(verifyPayload?.message ?? "Invalid verification code.");
              return;
            }

            if (verifyResponse.status === 503 && verifyPayload?.errorCode === "DATABASE_UNAVAILABLE") {
              setError("The backend cannot reach PostgreSQL right now. Start PostgreSQL and try again.");
              return;
            }

            setMfaRequired(true);
            setVerificationCode(previewCode);
            setError(verifyPayload?.message ?? "Unable to complete sign in right now.");
            return;
          }

          const accessToken = verifyPayload?.data?.accessToken;
          if (typeof accessToken === "string") {
            setAccessToken(accessToken);
          }

          const invitationNextPath = invitationToken
            ? `/onboarding/accept-invitation?token=${encodeURIComponent(invitationToken)}`
            : null;
          const sessionNextPath = invitationNextPath ?? nextPath ?? verifyPayload?.data?.nextPath ?? "/dashboard";
          const sessionUrl = `/auth/session?token=${encodeURIComponent(accessToken ?? "")}&next=${encodeURIComponent(sessionNextPath)}`;
          window.location.assign(sessionUrl);
          return;
        }

        setMfaRequired(true);
        setVerificationCode("");
        setError("A verification code has been sent to your email address.");
        return;
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError(payload?.message ?? (mfaRequired ? "Invalid verification code." : invitationFlowActive ? "This invitation may need a new account. Use the create account option below." : "Invalid email or password."));
          return;
        }

        if (response.status === 503 && payload?.errorCode === "DATABASE_UNAVAILABLE") {
          setError("The backend cannot reach PostgreSQL right now. Start PostgreSQL and try again.");
          return;
        }

        setError(payload?.message ?? "Unable to sign in right now.");
        return;
      }

      const accessToken = payload?.data?.accessToken;
      if (typeof accessToken === "string") {
        setAccessToken(accessToken);
      }

      const invitationNextPath = invitationToken
        ? `/onboarding/accept-invitation?token=${encodeURIComponent(invitationToken)}`
        : null;
      const sessionNextPath = invitationNextPath ?? nextPath ?? payload?.data?.nextPath ?? "/dashboard";
      const sessionUrl = `/auth/session?token=${encodeURIComponent(accessToken ?? "")}&next=${encodeURIComponent(sessionNextPath)}`;
      window.location.assign(sessionUrl);
    } catch (loginError) {
      if (loginError instanceof BackendApiError) {
        if (loginError.statusCode === 503 && loginError.errorCode === "DATABASE_UNAVAILABLE") {
          setError("The backend cannot reach PostgreSQL right now. Start PostgreSQL and try again.");
          return;
        }

        setError(loginError.message);
        return;
      }

      setError("The backend is not reachable right now. Make sure the backend and PostgreSQL are running.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingShell
      badge="Welcome back"
      title="A secure sign-in for your continuity workspace."
      subtitle="Access your saved records, trusted contacts, and release settings with a clean, trusted login flow."
      highlight="Your information is encrypted and accessible only through a structured release process."
      primaryImage={{
        src: "/onboarding-showcase/login-hero.jpg",
        alt: "Secure vault and digital lock concept",
        caption: "Secure access",
      }}
    >
      <div className="flex flex-col gap-10">
        <BrandHeader />

        <div className="max-w-[560px] space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">
              Welcome back
            </p>
            <h2 className="text-[clamp(2.2rem,3.6vw,3.45rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              Sign in to your continuity workspace.
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              Access the family records and continuity details you have already organized.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/onboarding/login?mode=nominee"
                className="inline-flex h-10 items-center rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm font-semibold text-[#2453A6] transition hover:bg-[#F8FAFC]"
              >
                Nominee login
              </Link>
              <Link
                href="/onboarding/login"
                className="inline-flex h-10 items-center rounded-2xl border border-transparent bg-[#EEF4FF] px-4 text-sm font-semibold text-[#163B8B] transition hover:bg-[#E2EAFF]"
              >
                Owner login
              </Link>
            </div>
            {nextPath?.includes("/onboarding/accept-invitation") ? (
              <Notice title="Invitation flow detected">
                Use the email address that received the invitation. After sign-in, we will return you to the invitation screen automatically.
              </Notice>
            ) : null}
            {invitationContext ? (
              <Notice title="Nominee invitation loaded">
                <span className="block font-semibold text-[#0F172A]">{invitationContext.fullName}</span>
                {invitationContext.email ? <span className="block text-slate-600">{invitationContext.email}</span> : null}
                {invitationContext.expiresAt ? (
                  <span className="block text-xs uppercase tracking-[0.22em] text-slate-500">
                    {invitationContext.isExpired ? "Expired" : "Expires"} {new Date(invitationContext.expiresAt).toLocaleString()}
                  </span>
                ) : null}
              </Notice>
            ) : null}
            {invitationFlowActive ? (
              <div className="rounded-[28px] border border-[#C7D2FE] bg-[#EEF4FF] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#163B8B]">Nominee portal</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Invited nominees should use the email linked to the invitation. If you do not have the account yet, create it first and then return here to accept the invite.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={createAccountHref}
                    className="inline-flex h-11 items-center rounded-2xl bg-[#163B8B] px-4 text-sm font-semibold text-white transition hover:bg-[#12306f]"
                  >
                    Create nominee account
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowCredentialForm(true)}
                    className="inline-flex h-11 items-center rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm font-semibold text-[#2453A6] transition hover:bg-[#F8FAFC]"
                  >
                    Sign in as nominee
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {error ? <Notice title="Sign-in issue">{error}</Notice> : null}

          {invitationFlowActive && !showCredentialForm ? (
            <div className="space-y-4 rounded-[28px] border border-[#DCE3EC] bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#0F172A]">Need to continue the invitation?</p>
                <p className="text-sm leading-6 text-[#64748B]">
                  If you already have the invited account, sign in with that email. If not, create the invited account first and we will bring you back here automatically.
                </p>
                {invitationToken ? (
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Invitation token detected
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowCredentialForm(true)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#163B8B] px-4 text-sm font-medium text-white transition hover:bg-[#12306f]"
                >
                  I already have this account
                </button>
                <Link
                  href={createAccountHref}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm font-medium text-[#2453A6] transition hover:bg-[#F8FAFC]"
                >
                  I need to create it
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  onBlur={() => handleBlur("email")}
                  className="pl-12"
                />
              </div>
              {touched.email && fieldErrors.email ? <p className="text-sm text-red-600">{fieldErrors.email}</p> : null}

              {!mfaRequired ? (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(event) => handleChange("password", event.target.value)}
                    onBlur={() => handleBlur("password")}
                    className="pl-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#163B8B]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit verification code"
                      value={verificationCode}
                      onChange={(event) => handleChange("verificationCode", event.target.value)}
                      onBlur={() => handleBlur("verificationCode")}
                      className="pl-12"
                    />
                  </div>
                  {mfaPreviewCode ? (
                    <Notice title="Development verification code">
                      The local email provider is not delivering external mail in this environment, so the code has been filled in for you.
                    </Notice>
                  ) : null}
                  {touched.verificationCode && fieldErrors.verificationCode ? <p className="text-sm text-red-600">{fieldErrors.verificationCode}</p> : null}
                </>
              )}
              {!mfaRequired && touched.password && fieldErrors.password ? <p className="text-sm text-red-600">{fieldErrors.password}</p> : null}

              <div className="flex items-center justify-between gap-3">
                <div className="text-right">
                  <Link
                    href="/onboarding/forgot-password"
                    className="text-sm font-medium text-[#2453A6] hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>

                {mfaRequired ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-[#2453A6] hover:underline"
                    onClick={() => {
                      setMfaRequired(false);
                      setVerificationCode("");
                      setMfaPreviewCode("");
                      setError("");
                      setFieldErrors((current) => ({ ...current, verificationCode: undefined }));
                    }}
                  >
                    Use password instead
                  </button>
                ) : null}
              </div>

              <Button type="submit" className="flex h-[60px] w-full items-center justify-center" disabled={submitting}>
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">{submitting ? "Signing In..." : mfaRequired ? "Verify and Sign In" : "Login"}</span>
              </Button>
            </form>
          )}

          <div className="text-sm text-[#64748B]">
            Don&apos;t have an account?{" "}
            <Link href={createAccountHref} className="font-semibold text-[#2453A6] hover:text-[#1E40AF]">
              Create Account
            </Link>
          </div>

          {invitationFlowActive ? (
            <div className="rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFC] p-4">
              <p className="text-sm font-medium text-[#0F172A]">No account yet?</p>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">
                Create the invited nominee account using this email, verify it, then come back here and we will continue the invitation flow.
              </p>
              <div className="mt-3">
                <Link
                  href={createAccountHref}
                  className="inline-flex h-11 items-center rounded-2xl bg-[#163B8B] px-4 text-sm font-semibold text-white transition hover:bg-[#12306f]"
                >
                  Create invited account
                </Link>
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#163B8B]" />
            <p className="text-sm leading-6 text-[#4B5563]">
              Your information is encrypted and accessible only through a structured release process.
            </p>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
