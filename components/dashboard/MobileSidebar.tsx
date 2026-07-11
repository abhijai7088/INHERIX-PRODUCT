"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { getActiveNavigationHref, getNavigationSectionsForRole } from "@/lib/navigation";
import { getAccountLabel, getInitials, type AccountRole } from "@/lib/account";
import { getCurrentUser } from "@/lib/trigger-api";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>["user"];

interface Props {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export default function MobileSidebar({ open, setOpen }: Props) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const role = account?.role as AccountRole | null | undefined;
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

  const renderMenu = (
    items: ReturnType<typeof getNavigationSectionsForRole>[number]["items"]
  ) =>
    items.map((menu) => {
      const Icon = menu.icon;
      const active = activeNavigationHref === menu.href;

      return (
        <Link
          key={menu.title}
          href={menu.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-medium transition-all duration-200 ${
            active
              ? "bg-[#163B8C] text-white shadow-sm"
              : "text-[#334155] hover:bg-[#EEF4FF] hover:text-[#163B8C]"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />

          <span className="truncate">{menu.title}</span>
        </Link>
      );
    });

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm xl:hidden"
        />
      )}

      <aside
        className={`
    fixed
    top-0
    left-0
    z-50
    flex
    h-[100dvh]
    w-[85vw]
    max-w-[320px]
    flex-col
    border-r
    border-[#DCE3EC]
    bg-white
    shadow-xl
    transition-transform
    duration-300
    xl:hidden
    ${open ? "translate-x-0" : "-translate-x-full"}
  `}
      >
        <div className="shrink-0 border-b border-[#E8EEF5] px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[26px] font-semibold tracking-tight text-[#163B8C]">
                  INHERIX
                </h1>
              </div>

              <p className="text-[11px] font-medium text-slate-500">
                Digital Continuity Institution
              </p>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE3EC]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3">
          <div className="space-y-2 pb-40">
            {visibleSections.map((section) => (
              <div key={section.title}>
                <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400">
                  {section.title.toUpperCase()}
                </p>

                <div className="space-y-1">{renderMenu(section.items)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#E8EEF5] bg-white p-4">
          <button className="flex w-full items-center gap-3 rounded-2xl border border-[#DCE3EC] bg-[#FAFBFC] px-3 py-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#163B8C] text-xs font-semibold text-white">
                {getInitials(account?.fullName ?? "INHERIX")}
              </div>

              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>

            <div className="flex-1 text-left">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">
                {account?.fullName ?? "Signed-in account"}
              </h3>

              <p className="text-[11px] text-slate-500">{getAccountLabel(account?.role)}</p>
            </div>

            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </aside>
    </>
  );
}
