import Link from "next/link";
import { ArrowRight, Globe, Lock, ShieldCheck, Users } from "lucide-react";

import BrandHeader from "@/components/onboarding/BrandHeader";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

export default function SplashScreen() {
  return (
    <OnboardingShell
      badge="Plan your family continuity"
      title="A secure home for family continuity."
      subtitle="Keep records, trusted contacts, and release settings together in one calm product experience."
      highlight="A secure starting point for families who want one place to organize what matters most."
      primaryImage={{
        src: "/onboarding-showcase/welcome-hero.jpg",
        alt: "Family reviewing a digital continuity plan together",
        caption: "Platform introduction",
      }}
    >
      <div className="flex flex-col gap-10">
        <BrandHeader />

        <div className="max-w-[700px] space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#163B8B]">
            Continuity, organised
          </p>

          <h1 className="max-w-3xl text-[clamp(2.6rem,5vw,4.75rem)] font-black leading-[0.98] tracking-tight text-[#0B1736]">
            Secure your family&apos;s important information in one trusted place.
          </h1>

          <p className="max-w-2xl text-[17px] leading-8 text-slate-600">
            INHERIX helps families organize records, trusted contacts, and release
            rules with a web experience that feels premium and clear.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding/welcome"
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-[#163B8B] px-6 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(22,59,140,0.22)] transition hover:bg-[#1D4ED8]"
            >
              Start Your Family Continuity Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <div className="inline-flex h-14 items-center justify-center rounded-2xl border border-[#DCE3EC] bg-white/80 px-6 text-sm font-semibold text-[#163B8B]">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Built for trust and control
            </div>
          </div>

          <div className="rounded-[28px] border border-[#DCE3EC] bg-white/75 px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
            <div className="grid gap-4 md:grid-cols-3 md:divide-x md:divide-[#E8EDF5]">
              <div className="flex items-start gap-3 md:pr-5">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#163B8B]" />
                <div>
                  <p className="text-sm font-semibold text-[#0B1736]">Secure records</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Store documents and continuity details with clarity and control.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 md:px-5">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#163B8B]" />
                <div>
                  <p className="text-sm font-semibold text-[#0B1736]">Family access</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Share responsibility with trusted people.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 md:pl-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#163B8B]" />
                <div>
                  <p className="text-sm font-semibold text-[#0B1736]">Controlled release</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Keep access structured and verifiable.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Globe className="h-4 w-4 text-[#5D8BFF]" />
            <span>www.inherix.net</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-[#163B8B]">Secure</span>
            <span className="font-semibold text-[#163B8B]">Organise</span>
            <span className="font-semibold text-[#163B8B]">Continue</span>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
