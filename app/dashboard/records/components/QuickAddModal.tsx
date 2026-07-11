"use client";

import Link from "next/link";

import {
  X,
  User,
  Landmark,
  Shield,
  FolderOpen,
  Home,
  ChevronRight,
} from "lucide-react";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const items = [
  {
    title: "Personal Information",
    subtitle: "Identity, profile and continuity references",
    icon: User,
    slug: "personal-information",
  },
  {
    title: "Financial Information",
    subtitle: "Banking, investments and wealth references",
    icon: Landmark,
    slug: "financial-information",
  },
  {
    title: "Family & Assets",
    subtitle: "Homes, shared assets and beneficiary notes",
    icon: Home,
    slug: "family-assets",
  },
  {
    title: "Legal Documents",
    subtitle: "Will, agreements and certificates",
    icon: FolderOpen,
    slug: "legal-documents",
  },
  {
    title: "Business Records",
    subtitle: "Operational continuity and reference files",
    icon: Shield,
    slug: "business-records",
  },
];

export default function QuickAddModal({
  open,
  setOpen,
}: Props) {

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020817]/60 p-4 backdrop-blur-sm">

      {/* MODAL */}

      <div className="relative w-full max-w-[420px] rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">

        {/* TOP BAR */}

        <div className="flex items-center justify-end px-4 pt-4">

          {/* CLOSE */}

          <button
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white transition hover:bg-[#F8FAFC]"
          >

            <X className="h-5 w-5 text-slate-500" />

          </button>

        </div>

        {/* CONTENT */}

        <div className="px-4 pb-4 pt-2">

          {/* LIST */}

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">

            {items.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.slug}
                  href={`/dashboard/records/add?category=${item.slug}`}
                  onClick={() => setOpen(false)}
                  className="group flex items-center justify-between rounded-[24px] border border-[#E2E8F0] bg-white p-4 transition-all duration-200 hover:border-[#163B8C] hover:bg-[#F8FBFF]"
                >

                  {/* LEFT */}

                  <div className="flex items-center gap-4">

                    {/* ICON */}

                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] transition group-hover:bg-[#163B8C]">

                      <Icon className="h-6 w-6 text-[#163B8C] group-hover:text-white" />

                    </div>

                    {/* TEXT */}

                    <div>

                      <h3 className="text-[15px] font-semibold text-[#0F172A]">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.subtitle}
                      </p>

                    </div>

                  </div>

                  {/* ARROW */}

                  <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8FAFC] transition group-hover:bg-[#163B8C]">

                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white" />

                  </div>

                </Link>
              );
            })}

          </div>

          {/* CANCEL */}

          <button
            onClick={() => setOpen(false)}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-medium text-slate-700 transition hover:bg-[#EEF2F7]"
          >

            Cancel

          </button>

        </div>

      </div>

    </div>
  );
}
