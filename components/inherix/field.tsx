import * as React from "react";

import { cn } from "@/lib/utils";

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-2 block text-sm font-medium text-[#0F172A]", className)}
      {...props}
    />
  );
}

function FieldHint({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("mt-2 text-xs leading-5 text-slate-500", className)}
      {...props}
    />
  );
}

function FormField({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("space-y-2", className)} {...props} />
  );
}

export { FieldHint, FieldLabel, FormField };

