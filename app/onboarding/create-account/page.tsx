"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import { Button } from "@/components/inherix/button";
import { Input } from "@/components/inherix/input";
import { Checkbox } from "@/components/inherix/checkbox";
import { Notice } from "@/components/inherix/notice";
import { FieldHint, FieldLabel, FormField } from "@/components/inherix/field";
import { backendJsonFetch } from "@/lib/auth-state";
import { loadNomineeInvitationContext } from "@/lib/nominees";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

type FormState = {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
};

type FieldName = keyof FormState;
type FieldErrors = Partial<Record<FieldName, string>>;

const initialState: FormState = {
  fullName: "",
  email: "",
  mobile: "",
  password: "",
  confirmPassword: "",
  consent: false,
};

export default function CreateAccountScreen() {
  const router = useRouter();
  const [search] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  const [form, setForm] = useState<FormState>(initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationContext, setInvitationContext] = useState<{ fullName: string; email: string | null; expiresAt: string | null; isExpired: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const invitationFlowActive = Boolean(invitationToken || nextPath?.startsWith("/onboarding/accept-invitation"));

  function resolveInvitationToken(search: URLSearchParams, inviteNextPath: string | null) {
    const directToken = search.get("token");
    if (directToken) {
      return directToken;
    }

    if (!inviteNextPath) {
      return null;
    }

    try {
      const nextUrl = new URL(inviteNextPath, window.location.origin);
      if (nextUrl.pathname !== "/onboarding/accept-invitation") {
        return null;
      }

      return nextUrl.searchParams.get("token");
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(search);
    const inviteNextPath = params.get("next");
    const resolvedToken = resolveInvitationToken(params, inviteNextPath);
    setNextPath(inviteNextPath);
    setInvitationToken(resolvedToken);
    const inviteEmail = params.get("email");

    if (inviteEmail) {
      setForm((current) => (current.email ? current : { ...current, email: inviteEmail }));
    }

    if (!resolvedToken) {
      return;
    }

    let cancelled = false;

    const loadInvitation = async () => {
      try {
        const payload = await loadNomineeInvitationContext(resolvedToken);

        if (cancelled) {
          return;
        }

        setInvitationContext(payload.invitation);
        setForm((current) => ({
          ...current,
          fullName: current.fullName || payload.invitation.fullName,
          email: current.email || payload.invitation.email || "",
        }));
      } catch {
        // Fallback to the email query param if the invitation lookup is unavailable.
      }
    };

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [search]);

  const passwordScore = useMemo(() => {
    const checks = [
      form.password.length >= 8,
      /[A-Z]/.test(form.password),
      /[a-z]/.test(form.password),
      /\d/.test(form.password),
    ];

    return checks.filter(Boolean).length;
  }, [form.password]);

  const validateField = (name: FieldName, value: FormState[FieldName], current: FormState = form) => {
    switch (name) {
      case "fullName":
        return typeof value === "string" && value.trim() ? "" : "Full name is required.";
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()) ? "" : "Enter a valid email address.";
      case "mobile": {
        const digitsOnly = String(value).replace(/\D/g, "");
        return /^[0-9+\-\s]{10,15}$/.test(String(value).trim()) && digitsOnly.length >= 10 && digitsOnly.length <= 15
          ? ""
          : "Enter a valid mobile number with 10 to 15 digits.";
      }
      case "password": {
        const password = String(value);
        if (password.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
        if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
        if (!/\d/.test(password)) return "Password must include at least one number.";
        return "";
      }
      case "confirmPassword":
        return current.password === value ? "" : "Passwords do not match.";
      case "consent":
        return value ? "" : "Please accept the terms and privacy policy.";
      default:
        return "";
    }
  };

  const validateForm = (current: FormState = form) => {
    const nextErrors: FieldErrors = {
      fullName: validateField("fullName", current.fullName, current),
      email: validateField("email", current.email, current),
      mobile: validateField("mobile", current.mobile, current),
      password: validateField("password", current.password, current),
      confirmPassword: validateField("confirmPassword", current.confirmPassword, current),
      consent: validateField("consent", current.consent, current),
    };

    for (const key of Object.keys(nextErrors) as FieldName[]) {
      if (!nextErrors[key]) {
        delete nextErrors[key];
      }
    }

    setFieldErrors(nextErrors);
    setTouched({
      fullName: true,
      email: true,
      mobile: true,
      password: true,
      confirmPassword: true,
      consent: true,
    });

    return nextErrors;
  };

  const handleChange = <K extends FieldName>(name: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [name]: value } as FormState;
      const errorMessage = validateField(name, value, next);
      setFieldErrors((currentErrors) => ({ ...currentErrors, [name]: errorMessage || undefined }));

      if (name === "password" || name === "confirmPassword") {
        const confirmError = validateField("confirmPassword", next.confirmPassword, next);
        setFieldErrors((currentErrors) => ({ ...currentErrors, confirmPassword: confirmError || undefined }));
      }

      return next;
    });
  };

  const handleBlur = <K extends FieldName>(name: K) => {
    setTouched((current) => ({ ...current, [name]: true }));
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: validateField(name, form[name], form) || undefined,
    }));
  };

  const invitationEmail = invitationContext?.email ?? "";
  const invitationName = invitationContext?.fullName ?? "";
  const emailLocked = Boolean(invitationFlowActive && invitationEmail);
  const nameLocked = Boolean(invitationFlowActive && invitationName);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateForm();
    if (Object.keys(validation).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await backendJsonFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fullName: emailLocked ? invitationName || form.fullName : form.fullName,
        email: emailLocked ? invitationEmail || form.email : form.email,
        invitationToken,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "Unable to create account right now.");
      return;
    }

    const payload = await response.json().catch(() => null);
    if (payload?.success) {
      const inviteNextPath = nextPath?.startsWith("/onboarding/accept-invitation") ? nextPath : null;
      const nextQuery = inviteNextPath ? `&next=${encodeURIComponent(inviteNextPath)}` : "";
      router.push(`/onboarding/verify-email?email=${encodeURIComponent(form.email.trim())}${nextQuery}`);
      return;
    }

    setError(payload?.message ?? "Unable to create account right now.");
  };

  return (
    <OnboardingShell
      badge="Create your continuity account"
      title="Create your continuity account."
      subtitle="Start building your Family Continuity Plan and securely organize the records, contacts, and instructions you want protected."
      highlight="Use your account to begin organizing continuity details with trusted access and clear control."
      primaryImage={{
        src: "/onboarding-showcase/create-hero.jpg",
        alt: "Family using a secure digital continuity workspace",
        caption: "Account setup",
      }}
    >
      <div className="flex flex-col gap-10">
        <BrandHeader />

        <div className="max-w-[620px] space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">
              Create your continuity account
            </p>
            <h2 className="text-[clamp(2.2rem,3.6vw,3.45rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              Create your account and begin the continuity plan.
            </h2>
            <p className="max-w-[56ch] text-[16px] leading-7 text-[#64748B]">
              Start building your Family Continuity Plan and securely organize the
              records, contacts, and instructions you want protected.
            </p>
            {invitationContext ? (
              <Notice title="Invite-only account loaded">
                <span className="block font-semibold text-[#0F172A]">{invitationContext.fullName}</span>
                {invitationContext.email ? <span className="block text-slate-600">{invitationContext.email}</span> : null}
                {invitationContext.expiresAt ? (
                  <span className="block text-xs uppercase tracking-[0.22em] text-slate-500">
                    Expires {new Date(invitationContext.expiresAt).toLocaleString()}
                  </span>
                ) : null}
              </Notice>
            ) : null}
            {invitationFlowActive && !invitationToken ? (
              <Notice title="Invitation token required">
                This invite flow needs the original invitation token to keep the account bound to the nominee record.
              </Notice>
            ) : null}
            {invitationFlowActive ? (
              <Notice title="Invitation flow detected">
                After registration and email verification, we will send you back to the invitation screen so you can accept the nominee invite.
              </Notice>
            ) : null}
          </div>

          {error ? (
            <Notice title="Check your details">
              {error}
            </Notice>
          ) : null}

          <form className="space-y-4" onSubmit={onSubmit}>
            <FormField>
              <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(event) => handleChange("fullName", event.target.value)}
                  onBlur={() => handleBlur("fullName")}
                  placeholder="Full Name"
                  className="pl-12"
                  readOnly={nameLocked}
                />
              </div>
              {nameLocked ? <FieldHint>Loaded from the invitation and locked to this nominee account.</FieldHint> : null}
              {touched.fullName && fieldErrors.fullName ? <FieldHint className="text-red-600">{fieldErrors.fullName}</FieldHint> : null}
            </FormField>

            <FormField>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  onBlur={() => handleBlur("email")}
                  placeholder="Email Address"
                  className="pl-12"
                  readOnly={emailLocked}
                />
              </div>
              {emailLocked ? <FieldHint>Must match the invited nominee email.</FieldHint> : null}
              {touched.email && fieldErrors.email ? <FieldHint className="text-red-600">{fieldErrors.email}</FieldHint> : null}
            </FormField>

            <FormField>
              <FieldLabel htmlFor="mobile">Mobile Number</FieldLabel>
              <Input
                id="mobile"
                inputMode="tel"
                autoComplete="tel"
                pattern="[0-9+\-\s]{10,15}"
                value={form.mobile}
                onChange={(event) => handleChange("mobile", event.target.value)}
                onBlur={() => handleBlur("mobile")}
                placeholder="+91 XXXXX XXXXX"
              />
              <FieldHint>We use this only for security and continuity communications.</FieldHint>
              {touched.mobile && fieldErrors.mobile ? <FieldHint className="text-red-600">{fieldErrors.mobile}</FieldHint> : null}
            </FormField>

            <FormField>
              <FieldLabel htmlFor="password">Create Password</FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  onBlur={() => handleBlur("password")}
                  placeholder="Create Password"
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
              <FieldHint>
                Use 8+ characters with a mix of upper-case, lower-case, and numbers.
                Score:
                {` ${passwordScore}/4`}
              </FieldHint>
              {touched.password && fieldErrors.password ? <FieldHint className="text-red-600">{fieldErrors.password}</FieldHint> : null}
            </FormField>

            <FormField>
              <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) => handleChange("confirmPassword", event.target.value)}
                  onBlur={() => handleBlur("confirmPassword")}
                  placeholder="Confirm Password"
                  className="pl-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#163B8B]"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {touched.confirmPassword && fieldErrors.confirmPassword ? <FieldHint className="text-red-600">{fieldErrors.confirmPassword}</FieldHint> : null}
            </FormField>

            <label className="flex items-start gap-3 rounded-2xl border border-[#DCE3EC] bg-[#F8FAFD] p-4">
              <Checkbox
                checked={form.consent}
                onChange={(event) => handleChange("consent", event.target.checked)}
                className="mt-1"
              />
              <span className="text-[13px] leading-6 text-[#4B5563]">
                I agree to the{" "}
                <span className="font-semibold text-[#2453A6]">Terms & Privacy Policy</span>{" "}
                and{" "}
                <span className="font-semibold text-[#2453A6]">Consent Policy</span>
              </span>
            </label>
            {touched.consent && fieldErrors.consent ? <FieldHint className="text-red-600">{fieldErrors.consent}</FieldHint> : null}

            <Button
              type="submit"
              className="flex h-[60px] w-full items-center justify-center"
              disabled={submitting || Boolean(invitationFlowActive && !invitationToken)}
            >
              <ShieldCheck className="h-5 w-5" />
              <span className="flex-1 text-center text-sm font-semibold">
                {submitting ? "Creating Account..." : invitationFlowActive ? "Create Invited Account" : "Start Continuity Setup"}
              </span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="text-sm text-[#64748B]">
            Already have an account?{" "}
            <Link
              href="/onboarding/login"
              className="font-semibold text-[#2453A6] hover:text-[#1E40AF]"
            >
              Sign In
            </Link>
          </div>

          <div className="flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#163B8B]" />
            <p className="text-sm leading-6 text-[#4B5563]">
              Your information is encrypted and accessible only through a
              structured release process.
            </p>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
