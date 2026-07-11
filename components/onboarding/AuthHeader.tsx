interface Props {
  title: string;
  description?: string;
}

export default function AuthHeader({
  title,
  description,
}: Props) {
  return (
    <div className="text-center">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#163B8C] shadow-sm">

        <span className="text-2xl font-semibold text-white">
          I
        </span>

      </div>
      <h1 className="mt-8 text-[40px] font-semibold tracking-tight text-[#0F172A]">

        {title}

      </h1>
      {description && (
        <p className="mx-auto mt-4 max-w-[300px] text-[16px] leading-8 text-slate-500">

          {description}

        </p>
      )}

    </div>
  );
}
