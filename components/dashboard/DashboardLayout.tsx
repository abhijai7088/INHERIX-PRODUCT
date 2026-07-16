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
  const [showWATooltip, setShowWATooltip] = useState(false);

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

      {/* Floating WhatsApp Support Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {showWATooltip && (
          <div
            className="mb-1 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-[0_8px_32px_rgba(37,211,102,0.18)]"
            style={{ animation: "fadeInUp 0.15s ease-out forwards" }}
          >
            <p className="text-[13px] font-semibold text-[#0F172A]">Need help?</p>
            <p className="mt-0.5 text-xs text-slate-500">Chat with us on WhatsApp</p>
          </div>
        )}
        <a
          href="https://wa.me/917291886646?text=Hello%2C%20I%20need%20help%20with%20Inherix."
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          onMouseEnter={() => setShowWATooltip(true)}
          onMouseLeave={() => setShowWATooltip(false)}
          onFocus={() => setShowWATooltip(true)}
          onBlur={() => setShowWATooltip(false)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          style={{
            backgroundColor: "#25D366",
            boxShadow: "0 4px 24px rgba(37,211,102,0.4)",
          }}
        >
          {/* Pulse ring animation */}
          <span
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              backgroundColor: "#25D366",
              animation: "whatsappPulse 2s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
          {/* WhatsApp icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="relative z-10 h-7 w-7"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 10 2z" opacity="0"/>
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12a9.954 9.954 0 001.437 5.168L2 22l4.979-1.413A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.952 7.952 0 01-4.053-1.107l-.29-.173-3.003.851.852-2.912-.19-.302A7.96 7.96 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
          </svg>
        </a>
      </div>

      <style>{`
        @keyframes whatsappPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

    </div>
  );
}
