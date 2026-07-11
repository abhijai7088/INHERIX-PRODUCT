import Image from "next/image";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export default function BrandHeader({ className }: Props) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-4">
        <Image
          src="/logo.png"
          alt="INHERIX"
          width={64}
          height={64}
          priority
        />

        <div className="flex flex-col">
          <p className="text-[30px] font-black tracking-tight text-[#0B1736] sm:text-[34px]">
            INHERIX
          </p>
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#163B8B] sm:text-[13px]">
            Digital Continuity Institution
          </p>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#DCE3EC] to-transparent" />
    </div>
  );
}
