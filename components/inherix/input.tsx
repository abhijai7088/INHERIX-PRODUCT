import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-12 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 text-sm text-[#0F172A] outline-none placeholder:text-slate-400 transition focus:border-[#163B8C] focus-visible:ring-2 focus-visible:ring-[#163B8C]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        className
      )}
      {...props}
    />
  );
}

export { Input };

