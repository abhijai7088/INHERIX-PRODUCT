import Link from "next/link";
import { ArrowRight, ShieldAlert, Smartphone } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/inherix/button";
import { Notice } from "@/components/inherix/notice";

export default function SetupPinPage() {
  return (
    <OnboardingShell
      badge="PIN setup"
      title="PIN setup is handled after authentication."
      subtitle="The PIN step is only shown when your role or device policy requires it. Sign in first to continue."
      highlight="This avoids exposing setup screens to users who should not see them yet."
      primaryImage={{
        src: "/onboarding-showcase/login-secondary-2.jpg",
        alt: "Secure PIN setup guidance",
        caption: "PIN setup",
      }}
    >
      <div className="flex flex-col gap-8">
        <BrandHeader />

        <div className="max-w-[620px] space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">PIN setup</p>
            <h2 className="text-[clamp(2.1rem,3.5vw,3.3rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              Use login first, then complete any device PIN requirement.
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              If your account needs a PIN, the platform will only ask for it after you sign in and prove the account is active.
            </p>
          </div>

          <Notice title="No direct PIN form">
            We keep this page informational so the setup flow remains role-aware and secure.
          </Notice>

          <div className="rounded-[24px] border border-[#DCE3EC] bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-5 w-5 text-[#163B8B]" />
              <p className="text-sm leading-6 text-[#4B5563]">
                The PIN step is typically used alongside MFA or first-login hardening for higher-trust roles and devices.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-12 rounded-2xl">
              <Link href="/onboarding/login">
                <Smartphone className="h-4 w-4" />
                Go to login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
