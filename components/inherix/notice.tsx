import * as React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

function Notice({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[24px] border border-[#DCE3EC] bg-[#F8FAFD] p-4 text-sm leading-6 text-[#334155]",
        className
      )}
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#163B8C]" />
      <div>
        {title ? <p className="font-semibold text-[#0F172A]">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export { Notice };

