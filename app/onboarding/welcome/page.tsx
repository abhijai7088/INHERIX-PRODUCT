import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

export default function WelcomeScreen() {
  return (
    <OnboardingShell
      badge="Plan your family continuity"
      title="Welcome to INHERIX."
      subtitle="Organize family records, trusted contacts, and continuity instructions in one secure place."
      highlight="A simple starting point for continuing the setup or returning to your workspace."
      primaryImage={{
        src: "/onboarding-showcase/welcome-hero.jpg",
        alt: "Family reviewing a digital vault on a laptop",
        caption: "Family continuity preview",
      }}
    >
      <div className="flex flex-col gap-10">
        <BrandHeader />

        <div className="max-w-[620px] space-y-6">
          <h2 className="text-[clamp(2.2rem,3.8vw,3.7rem)] font-black leading-[0.98] tracking-tight text-[#0F172A]">
            Create Your Family Continuity Plan
          </h2>

          <p className="text-[17px] leading-8 text-[#64748B]">
            Secure your family&apos;s digital continuity, trusted advisors,
            beneficiaries, important records, and continuity instructions in one
            protected platform.
          </p>

          <Link
            href="/onboarding/create-account"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#163B8B] px-6 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(22,59,140,0.22)] transition hover:bg-[#1D4ED8]"
          >
            <ShieldCheck className="h-5 w-5" />
            <span>Get Started</span>
            <ArrowRight className="h-5 w-5" />
          </Link>

          <div className="text-sm text-[#64748B]">
            Already have an account?{" "}
            <Link
              href="/onboarding/login"
              className="font-semibold text-[#2453A6] transition hover:text-[#1E40AF]"
            >
              Log In
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
