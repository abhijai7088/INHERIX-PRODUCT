"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/inherix/button";
import { Input } from "@/components/inherix/input";
import { Notice } from "@/components/inherix/notice";
import { backendJsonFetch } from "@/lib/auth-state";

export default function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [touched, setTouched] = useState<{ password?: boolean; confirmPassword?: boolean }>({});

  const validatePassword = (value: string) => {
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(value)) return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(value)) return "Password must include at least one lowercase letter.";
    if (!/\d/.test(value)) return "Password must include at least one number.";
    return "";
  };

  const validateConfirm = (value: string, currentPassword: string) => {
    if (!value.trim()) return "Please confirm your password.";
    return value === currentPassword ? "" : "Passwords do not match.";
  };

  const updateFieldError = (field: "password" | "confirmPassword", value: string) => {
    setFieldErrors((current) => {
      const next = { ...current };
      if (field === "password") {
        next.password = validatePassword(value) || undefined;
        next.confirmPassword = validateConfirm(confirmPassword, value) || undefined;
      } else {
        next.confirmPassword = validateConfirm(value, password) || undefined;
      }
      return next;
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ password: true, confirmPassword: true });

    if (!token) {
      setError("The reset link is missing a token.");
      return;
    }

    const passwordError = validatePassword(password);
    const confirmError = validateConfirm(confirmPassword, password);
    setFieldErrors({
      password: passwordError || undefined,
      confirmPassword: confirmError || undefined,
    });

    if (passwordError || confirmError) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setError("");
    void backendJsonFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? "Unable to update password right now.");
        return;
      }

      setSuccess(true);
      router.push("/onboarding/login");
    });
  };

  return (
    <OnboardingShell
      badge="Password reset"
      title="Create a new secure password."
      subtitle="Choose a password that lets you continue into your continuity workspace with confidence."
      highlight="Reset links are one-time use and tied to your account for security."
      primaryImage={{
        src: "/onboarding-showcase/login-hero.jpg",
        alt: "Secure password reset and vault access imagery",
        caption: "Reset flow",
      }}
    >
      <div className="flex flex-col gap-8">
        <BrandHeader />

        <div className="max-w-[620px] space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">
              Password reset
            </p>
            <h2 className="text-[clamp(2.1rem,3.5vw,3.3rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              Reset your password and sign back in.
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              Create a new secure password to continue accessing your continuity workspace.
            </p>
          </div>

          {error ? <Notice title="Check your password">{error}</Notice> : null}
          {success ? <Notice title="Password updated">Your password has been refreshed successfully.</Notice> : null}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="New Password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  updateFieldError("password", event.target.value);
                }}
                onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                className="pl-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  updateFieldError("confirmPassword", event.target.value);
                }}
                onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
                className="pl-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {touched.password && fieldErrors.password ? <p className="text-sm text-red-600">{fieldErrors.password}</p> : null}
            {touched.confirmPassword && fieldErrors.confirmPassword ? <p className="text-sm text-red-600">{fieldErrors.confirmPassword}</p> : null}

            <Button type="submit" className="flex h-[60px] w-full items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-semibold">{success ? "Password Saved" : "Update Password"}</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="text-sm text-[#64748B]">
            <Link href="/onboarding/login" className="font-semibold text-[#2453A6] hover:text-[#1E40AF]">
              Back to login
            </Link>
          </div>

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
