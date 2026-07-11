"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/inherix/button";
import { Input } from "@/components/inherix/input";
import { Notice } from "@/components/inherix/notice";
import { backendJsonFetch } from "@/lib/auth-state";
import { getCurrentUser } from "@/lib/trigger-api";

export default function ForceResetPasswordClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [touched, setTouched] = useState<{ password?: boolean; confirmPassword?: boolean }>({});

  const validatePassword = (value: string) => {
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(value)) return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(value)) return "Password must include at least one lowercase letter.";
    if (!/\d/.test(value)) return "Password must include at least one number.";
    return "";
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        if (!active) {
          return;
        }

        if (!me.user.mustResetPassword) {
          router.replace(me.nextPath ?? "/dashboard");
          return;
        }
      } catch {
        if (active) {
          router.replace("/onboarding/login");
          return;
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
  }, [router]);

  const submit = async () => {
    setError("");
    setTouched({ password: true, confirmPassword: true });

    const passwordError = validatePassword(password);
    const confirmError = password === confirmPassword ? "" : "Passwords do not match.";
    setFieldErrors({
      password: passwordError || undefined,
      confirmPassword: confirmError || undefined,
    });

    if (passwordError || confirmError) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const response = await backendJsonFetch("/auth/force-reset-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to update your password.");
      }

      router.replace("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      badge="First sign-in"
      title="Set your permanent password."
      subtitle="Your temporary credential is only for the initial sign-in. Complete this step before continuing."
      highlight="This keeps privileged accounts locked until the reset is finished."
      primaryImage={{
        src: "/onboarding-showcase/login-secondary-2.jpg",
        alt: "Password reset workflow",
        caption: "Secure handoff",
      }}
    >
      <div className="flex flex-col gap-8">
        <BrandHeader />

        <div className="max-w-[560px] space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">Reset password</p>
            <h2 className="text-[clamp(2.1rem,3.5vw,3.3rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              Choose a permanent password.
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              This account was created by the super admin and must be finalized before any operational access is granted.
            </p>
          </div>

          {error ? <Notice title="Password issue">{error}</Notice> : null}

          <div className="space-y-4">
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  password: validatePassword(event.target.value) || undefined,
                  confirmPassword: confirmPassword && event.target.value !== confirmPassword ? "Passwords do not match." : undefined,
                }));
              }}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            />
            {touched.password && fieldErrors.password ? <p className="text-sm text-red-600">{fieldErrors.password}</p> : null}
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  confirmPassword: event.target.value === password ? undefined : "Passwords do not match.",
                }));
              }}
              onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
            />
            {touched.confirmPassword && fieldErrors.confirmPassword ? <p className="text-sm text-red-600">{fieldErrors.confirmPassword}</p> : null}
            <Button type="button" className="h-14 w-full rounded-2xl" onClick={submit} disabled={loading || saving}>
              <span className="flex-1 text-center">{saving ? "Saving..." : "Set password"}</span>
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
