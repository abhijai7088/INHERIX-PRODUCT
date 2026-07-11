import Link from "next/link";
import { ShieldCheck, Lock, ArrowRight } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/inherix/button";
import { Notice } from "@/components/inherix/notice";

export default function SecuritySetupPage() {
  return (
    <OnboardingShell
      badge="Security setup"
      title="Security setup happens after sign-in."
      subtitle="This workspace uses password, email verification, and role-aware access before any protected setup steps are available."
      highlight="If you were sent here early, sign in first and we will return you to the correct security step."
      primaryImage={{
        src: "/onboarding-showcase/login-secondary-1.jpg",
        alt: "Security setup guidance",
        caption: "Security setup",
      }}
    >
      <div className="flex flex-col gap-8">
        <BrandHeader />

        <div className="max-w-[620px] space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">Security setup</p>
            <h2 className="text-[clamp(2.1rem,3.5vw,3.3rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
              Complete sign-in first, then continue security setup.
            </h2>
            <p className="max-w-[52ch] text-[16px] leading-7 text-[#64748B]">
              Security setup is role-aware. Once you authenticate, the platform will guide you into the correct next step for your account.
            </p>
          </div>

          <Notice title="No direct setup here">
            This page is informational by design. Use your login or recovery path first, then return here only if your account requires additional security enrollment.
          </Notice>

          <div className="rounded-[24px] border border-[#DCE3EC] bg-white/70 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-[#163B8B]" />
              <p className="text-sm leading-6 text-[#4B5563]">
                After login, the system can direct you to MFA enrollment, password reset, or role-specific access setup as needed.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-12 rounded-2xl">
              <Link href="/onboarding/login">
                <Lock className="h-4 w-4" />
                Go to login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-2xl">
              <Link href="/onboarding/forgot-password">Recover account</Link>
            </Button>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
