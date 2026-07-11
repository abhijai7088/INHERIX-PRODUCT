"use client";

import { Menu } from "lucide-react";
import NotificationsDropdown from "./NotificationsDropdown";

interface Props {
  setOpen: (value: boolean) => void;
}

export default function MobileTopbar({
  setOpen,
}: Props) {
  return (
<header
  className="
    sticky
    top-0
    z-40
    flex
    h-16
    items-center
    justify-between
    border-b
    border-[#DCE3EC]
    bg-white/90
    backdrop-blur
    px-4
    xl:hidden
  "
>
      <div className="flex items-center gap-3">

        <button
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE3EC] bg-white"
        >

          <Menu className="h-5 w-5 text-[#0F172A]" />

        </button>

        <div>

          <h1 className="text-[20px] font-semibold tracking-tight text-[#163B8C]">

            INHERIX

          </h1>

        </div>

      </div>

      <div className="mr-1 flex h-10 w-10 items-center justify-center">
<NotificationsDropdown />
</div>

    </header>
  );
}

