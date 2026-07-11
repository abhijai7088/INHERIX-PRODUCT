import * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "h-4 w-4 rounded border-[#C9D3E2] text-[#163B8C] focus:ring-2 focus:ring-[#163B8C]/30 focus:ring-offset-2 focus:ring-offset-white",
        className
      )}
      {...props}
    />
  );
}

export { Checkbox };

