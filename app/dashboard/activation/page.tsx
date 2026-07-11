
export default function ActivationPage() {
  return (
      <div className="space-y-6">

        <div>

          <h1 className="text-[32px] font-semibold text-[#0F172A]">
            Continuity Activation
          </h1>

          <p className="mt-2 text-slate-500">
            Configure continuity activation process.
          </p>

        </div>

        <div className="rounded-[28px] border border-[#DCE3EC] bg-white p-8">

          <div className="space-y-6">

            <div>

              <label className="text-sm font-medium text-slate-700">
                Trigger Type
              </label>

              <select className="mt-2 h-12 w-full rounded-2xl border border-[#DCE3EC] px-4">

                <option>Manual Review</option>
                <option>Automated Verification</option>

              </select>

            </div>

            <div>

              <label className="text-sm font-medium text-slate-700">
                Review Period
              </label>

              <input
                placeholder="Enter days"
                className="mt-2 h-12 w-full rounded-2xl border border-[#DCE3EC] px-4"
              />

            </div>

            <div>

              <label className="text-sm font-medium text-slate-700">
                Notes
              </label>

              <textarea
                rows={5}
                className="mt-2 w-full rounded-2xl border border-[#DCE3EC] p-4"
              />

            </div>

            <button className="h-12 rounded-2xl bg-[#163B8C] px-5 text-sm font-medium text-white">

              Continue

            </button>

          </div>

        </div>

      </div>

  );
}