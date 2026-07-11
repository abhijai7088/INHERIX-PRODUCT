const items = [
  {
    title: "Privacy Principles",
    desc: "We follow privacy by design and data minimization.",
  },
  {
    title: "Human Review Layer",
    desc: "Critical actions reviewed by authorized professionals.",
  },
  {
    title: "Access Controls",
    desc: "Granular access with role-based permissions.",
  },
  {
    title: "Continuity Safeguards",
    desc: "You remain in control across generations.",
  },
  {
    title: "Compliance",
    desc: "Bank-grade security and regular audits.",
  },
];

export default function GovernanceSection() {
  return (
    <div className="rounded-2xl border border-[#DCE3EC] bg-white p-5">
      <h2 className="text-[20px] font-semibold text-[#0F172A]">
        Trust & Governance
      </h2>

      <p className="mt-1 text-[13px] text-slate-500">
        Our commitment to protecting your legacy.
      </p>

      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-[#EEF2F7] p-4"
          >
            <h3 className="text-[14px] font-semibold text-[#0F172A]">
              {item.title}
            </h3>

            <p className="mt-2 text-[13px] leading-6 text-slate-500">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
