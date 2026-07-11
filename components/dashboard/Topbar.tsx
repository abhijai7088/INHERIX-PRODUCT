"use client";

import { Bell, Search, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/trigger-api";
import NotificationsDropdown from "./NotificationsDropdown";

export default function Topbar() {
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(res => setAccount(res.user)).catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 hidden h-[72px] w-full items-center justify-between border-b border-[#DCE3EC] bg-white px-6 xl:flex">
      <div className="flex w-full max-w-[400px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition-colors focus-within:border-[#163B8C] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#163B8C]">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Ask INHERIX or search anything..."
          className="flex-1 bg-transparent outline-none placeholder:text-slate-400"
        />
        <div className="flex shrink-0 items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          <span className="text-sm leading-none">⌘</span>
          <span>K</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/security" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-[#163B8C] transition hover:bg-slate-100">
            <ShieldCheck className="h-5 w-5" />
          </Link>
          <NotificationsDropdown />
        </div>

        <div className="h-8 w-px bg-slate-200" />

        <Link href="/dashboard/profile" className="flex items-center gap-3">
          <div className="flex h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {account?.fullName ? (
              <div className="flex h-full w-full items-center justify-center bg-[#163B8C] text-sm font-semibold text-white">
                {account.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
            ) : (
              <Image src="/avatar-placeholder.png" alt="Profile" width={40} height={40} className="object-cover" />
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-[#0F172A]">{account?.fullName ?? "Owner Account"}</p>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {account?.role ? account.role.replace('_', ' ') : 'Account'}
            </p>
          </div>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
