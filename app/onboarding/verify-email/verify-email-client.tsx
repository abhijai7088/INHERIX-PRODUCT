"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/inherix/button";
import { Notice } from "@/components/inherix/notice";
import { backendJsonFetch } from "@/lib/auth-state";

export default function VerifyEmailClient({ token, email, nextPath }: { token: string; email: string; nextPath?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(token));
  const [resendState, setResendState] = useState<"idle" | "sent">("idle");
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const verify = async () => {
      const response = await backendJsonFetch("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setLoading(false);
        setError(payload?.message ?? "Unable to verify this email link.");
        return;
      }

      setLoading(false);
      // Only carry forward accept-invitation paths; all other verification flows
      // (including any verification officer link) MUST redirect to the main login page.
      const isInvitationNext = nextPath?.startsWith("/onboarding/accept-invitation");
      const safeNextPath = isInvitationNext ? nextPath : "";
      const nextQuery = safeNextPath ? `?next=${encodeURIComponent(safeNextPath)}` : "";
      // Always redirect to the main login page after verification
      router.push(`/onboarding/login${nextQuery}`);
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router, token]);

  const resend = async () => {
    if (!email || isResending || cooldown > 0) {
      if (!email) setError("No email address is attached to this verification screen.");
      return;
    }

    setIsResending(true);
    setError("");

    try {
      const response = await backendJsonFetch("/auth/verify-email/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to send a new verification link.");
      }

      setResendState("sent");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <OnboardingShell
      badge="Email verification"
      title="Confirm your INHERIX email address."
      subtitle="We verify each account before access is granted so the continuity workspace stays protected."
      highlight="Verification links are short-lived and can be resent only to the registered address."
      primaryImage={{
        src: "/onboarding-showcase/login-secondary-2.jpg",
        alt: "Secure email verification concept",
        caption: "Verification flow",
      }}
    >
      <div className="flex flex-col gap-8">
        <BrandHeader />

        <div className="max-w-[620px] space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">
              Verify your account
            </p>
            <h2 className="text-[clamp(2.1rem,3.5vw,3.3rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              {token ? "Checking your verification link." : "A verification link has been sent."}
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              {token
                ? "We are confirming your email before redirecting you to sign in."
                : "Use the resend button if you need a fresh verification email."}
            </p>
          </div>

          {loading ? <Notice title="Verifying">Please wait while we confirm your email address.</Notice> : null}
          {error ? <Notice title="Verification issue" className="border-red-200 bg-red-50 [&>svg]:text-red-600"><span className="text-red-900">{error}</span></Notice> : null}
          {resendState === "sent" ? <Notice title="Resent">A fresh verification message has been prepared.</Notice> : null}

          <div className="space-y-4">
            <Button
              type="button"
              onClick={resend}
              className="h-14 w-full rounded-2xl"
              disabled={loading || isResending || cooldown > 0 || !email}
            >
              <span className="flex-1 text-center">
                {isResending 
                  ? "Sending..." 
                  : cooldown > 0 
                  ? `Resend in ${cooldown}s` 
                  : "Resend Email"}
              </span>
            </Button>

            <button
              type="button"
              onClick={() => router.push("/onboarding/login")}
              className="w-full text-[15px] text-[#64748B]"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
