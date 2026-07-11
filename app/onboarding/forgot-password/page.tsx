"use client";

import { useMemo, useState, useEffect } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Mail, ShieldCheck, ArrowRight } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/inherix/button";
import { Input } from "@/components/inherix/input";
import { Notice } from "@/components/inherix/notice";
import { backendJsonFetch } from "@/lib/auth-state";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailError = useMemo(() => {
    if (!emailTouched && !email) {
      return "";
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Enter a valid email address.";
  }, [email, emailTouched]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouched(true);

    if (!email.trim() || emailError || isLoading || cooldown > 0) {
      setError(emailError || "Enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await backendJsonFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "An error occurred. Please try again.");
      }

      setSent(true);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OnboardingShell
      badge="Account recovery"
      title="Recover access to your continuity workspace."
      subtitle="Use your registered email address and we will send a secure password reset link."
      highlight="Recovery messages are short-lived, account-bound, and auditable."
      primaryImage={{
        src: "/onboarding-showcase/login-secondary-1.jpg",
        alt: "Secure recovery and access control imagery",
        caption: "Recovery flow",
      }}
    >
      <div className="flex flex-col gap-8">
        <BrandHeader />

        <div className="max-w-[620px] space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">
              Account recovery
            </p>
            <h2 className="text-[clamp(2.1rem,3.5vw,3.3rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              Send a secure reset link to your email.
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              Enter the email address tied to your INHERIX account and we&apos;ll prepare a reset message if the account exists.
            </p>
          </div>

          {error ? (
            <Notice title="Request Failed" className="border-red-200 bg-red-50 [&>svg]:text-red-600">
              <span className="text-red-900">{error}</span>
            </Notice>
          ) : sent ? (
            <Notice title="Reset link sent">
              If the address exists in INHERIX, we&apos;ve prepared a secure reset message.
            </Notice>
          ) : null}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                disabled={isLoading}
                className="pl-12"
              />
            </div>
            {emailTouched && emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}

            <Button 
              type="submit" 
              disabled={isLoading || cooldown > 0 || !email.trim()} 
              className="flex h-[60px] w-full items-center justify-center"
            >
              <ShieldCheck className="h-5 w-5" />
              <span className="font-semibold">
                {isLoading 
                  ? "Sending..." 
                  : cooldown > 0 
                  ? `Resend in ${cooldown}s` 
                  : sent 
                  ? "Resend Reset Link" 
                  : "Send Reset Link"}
              </span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="text-sm text-[#64748B]">
            Remembered your password?{" "}
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
