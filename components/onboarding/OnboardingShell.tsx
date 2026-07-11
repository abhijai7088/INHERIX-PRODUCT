import Image from "next/image";
import type { ReactNode } from "react";

type ShowcaseCard = {
  src: string;
  alt: string;
  caption: string;
};

type Props = {
  title: string;
  subtitle: string;
  badge: string;
  children: ReactNode;
  primaryImage: ShowcaseCard;
  highlight: string;
};

export default function OnboardingShell({
  title,
  subtitle,
  badge,
  children,
  primaryImage,
  highlight,
}: Props) {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(22,59,140,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(29,78,216,0.08),transparent_26%),linear-gradient(180deg,#F8FAFD_0%,#EEF3FA_100%)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative border-b border-[#DCE3EC] bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(248,250,253,0.97))] lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(22,59,140,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.06),transparent_34%)]" />
          <div className="relative flex min-h-full w-full">
            <div className="flex w-full justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16 lg:py-10">
              <div className="w-full max-w-[720px]">{children}</div>
            </div>
          </div>
        </section>

        <aside className="relative overflow-hidden border-b border-[#DCE3EC] bg-[linear-gradient(180deg,#F7FBFF_0%,#EEF4FF_55%,#EAF1FF_100%)] lg:border-b-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_35%),linear-gradient(115deg,rgba(255,255,255,0.55),transparent_46%,rgba(22,59,140,0.06))]" />
          <div className="absolute -left-20 top-14 h-72 w-72 rounded-full bg-[#163B8B]/10 blur-3xl" />
          <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-[#3B82F6]/12 blur-3xl" />

          <div className="relative flex w-full justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16 lg:py-10">
            <div className="flex w-full max-w-[720px] flex-col gap-5 lg:gap-6">
              <div className="inline-flex w-fit rounded-full border border-[#CFE0FF] bg-white/90 px-4 py-2 text-sm font-semibold text-[#163B8B] shadow-[0_10px_28px_rgba(22,59,140,0.08)]">
                {badge}
              </div>

              <h2 className="max-w-[760px] text-[38px] font-black leading-[1.02] tracking-tight text-[#0B1736] sm:text-[44px] xl:text-[52px]">
                {title}
              </h2>

              <p className="max-w-[680px] text-[15px] leading-7 text-slate-600 sm:text-[16px]">
                {subtitle}
              </p>

              <div className="overflow-hidden rounded-[34px] border border-white/80 bg-white shadow-[0_28px_60px_rgba(15,23,42,0.12)]">
                <div className="relative aspect-[1.08] w-full">
                  <Image
                    src={primaryImage.src}
                    alt={primaryImage.alt}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,23,54,0.06),transparent_28%,transparent_74%,rgba(11,23,54,0.18))]" />
                  <div className="absolute left-5 top-5 inline-flex rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#163B8B] shadow-sm">
                    {primaryImage.caption}
                  </div>
                </div>

                <div className="border-t border-slate-100 px-6 py-5">
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">
                    {highlight}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
