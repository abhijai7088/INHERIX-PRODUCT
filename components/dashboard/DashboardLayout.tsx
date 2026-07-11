"use client";

import { useState } from "react";

import Sidebar from "./Sidebar";
import MobileSidebar from "./MobileSidebar";
import MobileTopbar from "./MobileTopbar";
import Topbar from "./Topbar";
import { RecordsProvider } from "./RecordsProvider";

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(22,59,140,0.06),_transparent_26%),linear-gradient(180deg,#F5F7FB_0%,#F5F7FB_100%)]">

      <div className="inherix-page-shell flex min-h-screen">
        <div className="hidden xl:block">
          <Sidebar />
        </div>
        <MobileSidebar
          open={open}
          setOpen={setOpen}
        />

        <RecordsProvider>
          <div className="flex min-w-0 flex-1 flex-col">

            <Topbar />
            <MobileTopbar
              setOpen={setOpen}
            />

            <div className="inherix-content-shell w-full flex-1">

              {children}
            </div>

          </div>
        </RecordsProvider>

      </div>

    </div>
  );
}
