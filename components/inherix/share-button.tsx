"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "outline" | "solid" | "ghost";
  text?: string;
};

export function ShareAppButton({ className, variant = "outline", text = "Share" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: "INHERIX - Digital Continuity Institution",
      text: "Secure your family's future with INHERIX, the digital continuity institution.",
      url: window.location.origin,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // Fallback to copy if share fails (e.g. user aborted)
        console.log("Share failed:", err);
      }
    }
    
    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const baseClasses = "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-300";
  
  const variants = {
    outline: "border border-[#DCE3EC] bg-white text-[#163B8C] hover:bg-[#F8FAFC] hover:border-[#163B8C]",
    solid: "bg-[#163B8C] text-white hover:bg-[#12306f]",
    ghost: "bg-transparent text-[#163B8C] hover:bg-[#EEF4FF]",
  };

  return (
    <button
      onClick={handleShare}
      className={cn(baseClasses, variants[variant], className)}
      type="button"
      aria-label="Share INHERIX"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
      <span>{copied ? "Copied!" : text}</span>
    </button>
  );
}
