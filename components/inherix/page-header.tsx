import * as React from "react";

import { cn } from "@/lib/utils";

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[32px] border border-[#DCE3EC] bg-white p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#163B8C]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-[#0F172A] sm:text-[38px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export { PageHeader };

