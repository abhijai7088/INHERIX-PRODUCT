import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3 text-sm text-[#0F172A] outline-none placeholder:text-slate-400 transition focus:border-[#163B8C] focus-visible:ring-2 focus-visible:ring-[#163B8C]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };

