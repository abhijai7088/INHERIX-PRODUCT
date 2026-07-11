import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border text-sm font-semibold transition-all outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#163B8C]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-[#163B8C] bg-[#163B8C] text-white shadow-sm hover:bg-[#102C6B]",
        outline:
          "border-[#DCE3EC] bg-white text-[#0F172A] hover:border-[#163B8C] hover:bg-[#F8FBFF]",
        secondary:
          "border-[#DCE3EC] bg-white text-[#0F172A] hover:border-[#163B8C] hover:bg-[#F8FBFF]",
        ghost:
          "border-transparent bg-transparent text-[#163B8C] hover:bg-[#EEF4FF]",
        destructive:
          "border-red-100 bg-red-50 text-red-700 hover:bg-red-100",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-12 px-5",
        lg: "h-14 px-6 text-base",
        icon: "h-10 w-10 px-0",
        "icon-sm": "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
