import * as React from "react";

import { cn } from "@/lib/utils";

function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-dashed border-[#C9D3E2] bg-white px-6 py-10 text-center",
        className
      )}
    >
      <h3 className="text-lg font-semibold text-[#0F172A]">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export { EmptyState };

