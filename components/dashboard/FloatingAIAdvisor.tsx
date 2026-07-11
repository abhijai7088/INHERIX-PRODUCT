"use client";

import { Bot, Search, Send, X } from "lucide-react";
import { useState } from "react";

export default function FloatingAIAdvisor() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0A1A3A] text-white shadow-xl transition-transform hover:scale-110"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[350px] overflow-hidden rounded-2xl bg-[#091738] text-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-blue-900/50 bg-[#0B1F4A] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/20">
            <Bot className="h-4 w-4 text-blue-300" />
          </div>
          <span className="text-xs font-semibold">INHERIX AI Advisor</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-blue-300">Online</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <button onClick={() => setOpen(false)} className="text-blue-300 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold">Hi Amit! How can I help you today?</p>
        
        <div className="mt-4 space-y-2">
          <button className="flex w-full items-center gap-2 rounded-lg bg-[#142A5C] px-3 py-2 text-left text-xs font-medium text-blue-100 transition hover:bg-[#1A3673]">
            <Search className="h-3 w-3 shrink-0" />
            What happens if something happens to me?
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg bg-[#142A5C] px-3 py-2 text-left text-xs font-medium text-blue-100 transition hover:bg-[#1A3673]">
            <Search className="h-3 w-3 shrink-0" />
            Is my family fully prepared?
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg bg-[#142A5C] px-3 py-2 text-left text-xs font-medium text-blue-100 transition hover:bg-[#1A3673]">
            <Search className="h-3 w-3 shrink-0" />
            What documents are still missing?
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg bg-[#142A5C] px-3 py-2 text-left text-xs font-medium text-blue-100 transition hover:bg-[#1A3673]">
            <Search className="h-3 w-3 shrink-0" />
            How secure is my continuity plan?
          </button>
        </div>
      </div>

      <div className="bg-[#0B1F4A] p-3">
        <div className="relative flex items-center rounded-lg bg-white pr-1">
          <input
            type="text"
            placeholder="Ask anything..."
            className="w-full bg-transparent py-2.5 pl-3 pr-10 text-xs text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button className="absolute right-1 flex h-7 w-7 items-center justify-center rounded bg-[#163B8C] text-white transition hover:bg-blue-800">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
