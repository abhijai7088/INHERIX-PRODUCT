"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Menu,
  X,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const links = [
  "How It Works",
  "Continuity Records",
  "Trust & Governance",
  "Security",
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">

      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

        <Link
          href="/"
          className="flex items-center gap-3"
        >

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B1220] shadow-sm">

            <span className="text-lg font-bold text-white">
              I
            </span>

          </div>

          <div>

            <h2 className="text-xl font-semibold tracking-tight text-slate-900">

              INHERIX

            </h2>

            <p className="hidden text-xs text-slate-500 sm:block">

              Digital Continuity Infrastructure

            </p>

          </div>

        </Link>
        <nav className="hidden items-center gap-10 lg:flex">

          {links.map((link) => (
            <Link
              key={link}
              href="#"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              {link}
            </Link>
          ))}

        </nav>
        <div className="hidden items-center gap-3 lg:flex">

          <Button
            variant="outline"
            className="h-11 rounded-full border-slate-300 px-5"
          >
            Book Consultation
          </Button>

          <Button className="h-11 rounded-full bg-[#0B1220] px-6 text-white hover:bg-[#111827]">
            Start Continuity Plan

            <ArrowRight className="ml-2 h-4 w-4" />

          </Button>

        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white lg:hidden"
        >

          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}

        </button>

      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white lg:hidden">

          <div className="space-y-8 px-6 py-8">

            <div className="flex flex-col gap-5">

              {links.map((link) => (
                <Link
                  key={link}
                  href="#"
                  className="text-lg font-medium text-slate-700"
                >
                  {link}
                </Link>
              ))}

            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">

              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">

                Governance Infrastructure

              </p>

              <h3 className="mt-3 text-lg font-semibold text-slate-900">

                Structured continuity systems designed for trust.

              </h3>

            </div>

            <div className="flex flex-col gap-3">

              <Button
                variant="outline"
                className="h-12 rounded-full"
              >
                Consultation
              </Button>

              <Button className="h-12 rounded-full bg-[#0B1220]">

                Start Continuity Plan

              </Button>

            </div>

          </div>

        </div>
      )}

    </header>
  );
}