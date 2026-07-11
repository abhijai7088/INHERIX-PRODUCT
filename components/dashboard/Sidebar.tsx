"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Shield } from "lucide-react";

import { getActiveNavigationHref, getNavigationSectionsForRole } from "@/lib/navigation";
import { getAccountLabel, getInitials, type AccountRole } from "@/lib/account";
import { getCurrentUser } from "@/lib/trigger-api";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>["user"];

export default function Sidebar() {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const role = account?.role as AccountRole | null | undefined;
  const isLoadingAccount = permissions === null && account === null;
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const me = await getCurrentUser();
        if (!active) {
          return;
        }

        setPermissions(me.permissions ?? []);
        setAccount(me.user);
      } catch {
        if (active) {
          setPermissions([]);
          setAccount(null);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const visibleSections = useMemo(
    () =>
      getNavigationSectionsForRole(role)
        .map((section) => ({
          ...section,
          items: section.items.filter((menu) => {
            if (!menu.requiredPermission) {
              return true;
            }

            return permissions?.includes(menu.requiredPermission) ?? false;
          }),
        }))
        .filter((section) => section.items.length > 0),
    [permissions, role]
  );

  const activeNavigationHref = useMemo(
    () => getActiveNavigationHref(pathname, visibleSections.flatMap((section) => section.items)),
    [pathname, visibleSections]
  );

  const renderMenu = (items: ReturnType<typeof getNavigationSectionsForRole>[number]["items"]) =>
    items.map((menu) => {
      const Icon = menu.icon;
      const active = activeNavigationHref === menu.href;

      return (
        <Link
          key={menu.title}
          href={menu.href}
          className={`group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-all duration-200 ${
            active
              ? "bg-[#EEF4FF] text-[#163B8C] font-semibold"
              : "text-slate-600 font-medium hover:bg-[#F8FAFC] hover:text-[#163B8C]"
          }`}
        >
          <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#163B8C]" : "text-slate-400 group-hover:text-[#163B8C]"}`} />

          <span className="truncate">
            {menu.title}
          </span>
        </Link>
      );
    });

  return (
    <aside className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col border-r border-[#DCE3EC] bg-white">

      <div className="border-b border-[#E8EEF5] px-5 py-5">

        <div className="flex items-center gap-3">

          <div className="flex h-14 w-14 items-center justify-center">
            <Image
              src="/logo.png"
              alt="INHERIX Logo"
              width={52}
              height={52}
              className="object-contain"
              priority
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[#163B8C]">
                INHERIX
              </h1>
            </div>
            <p className="text-[11px] font-medium text-[#163B8C] opacity-80">
              Digital Continuity
            </p>
          </div>
        </div>
        <p className="mt-4 text-[11px] font-medium text-[#163B8C] opacity-60">
          Your Family. Your Legacy. Our Protection.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {isLoadingAccount ? (
          <div className="rounded-2xl border border-[#DCE3EC] bg-[#F8FAFC] px-4 py-3 text-sm text-slate-500">
            Loading workspace...
          </div>
        ) : (
          <div className="space-y-5">
            {visibleSections.map((section) => (
              <div key={section.title || "section"}>
                {section.title ? (
                  <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400">
                    {section.title.toUpperCase()}
                  </p>
                ) : null}
                <div className="space-y-1">
                  {renderMenu(section.items)}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      <div className="mt-auto px-4 pb-4">
        <div className="relative overflow-hidden rounded-2xl bg-[#091738] p-5 text-white shadow-lg">
          <div className="relative z-10">
            <p className="text-[10px] uppercase tracking-wider text-blue-300">Your Digital Continuity</p>
            <h3 className="mt-1.5 text-lg font-bold leading-tight">Built For Families.<br/>Trusted For<br/>Generations.</h3>
            <p className="mt-2 text-[11px] leading-relaxed text-blue-200">Because tomorrow isn&apos;t promised.</p>
            
            <div className="mt-4 flex items-center justify-center py-2">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
                <div className="absolute inset-0 animate-pulse rounded-full bg-blue-500/20 blur-md" />
                <Shield className="h-8 w-8 text-blue-300" />
              </div>
            </div>

            <Link href="/dashboard/security" className="mt-4 flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-[#163B8C] transition-colors hover:bg-slate-50">
              View Security Center &rarr;
            </Link>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between px-1">
          <p className="text-[9px] leading-tight text-slate-400">
            © 2026 INHERIX Digital<br/>Continuity Pvt. Ltd.<br/>All rights reserved.
          </p>
          <button className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
