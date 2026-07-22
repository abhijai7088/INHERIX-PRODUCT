"use client";

import { CheckCircle2 } from "lucide-react";
import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

export function SetupStepper() {
  const { nominees, records, dashboardStats } = useRecordsStore();
  const verifiedNomineesCount = nominees.filter(n => n.status === "ACTIVE").length;
  const protectedRecordsCount = records.filter(r => !r.softDeleted).length;
  const emergencyReady = (dashboardStats?.activeRulesCount ?? 0) > 0;

  // Determine current step index (0 to 3)
  let currentStep = 0;
  if (verifiedNomineesCount > 0) currentStep = 1;
  if (currentStep === 1 && protectedRecordsCount > 0) currentStep = 2;
  if (currentStep === 2 && emergencyReady) currentStep = 3;

  const steps = [
    { title: "Add Nominee", subtitle: "Invite a trusted contact" },
    { title: "Secure Records", subtitle: "Upload documents" },
    { title: "Emergency Rules", subtitle: "Set access policies" },
    { title: "All Set", subtitle: "Fully protected" },
  ];

  return (
    <div className="mb-6 rounded-[16px] bg-white p-5 sm:p-7 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4">
        <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-[#163B8C] uppercase tracking-wider">Setup Progress</span>
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-8 mt-2">Complete Your Digital Continuity</h3>
      
      <div className="relative flex justify-between">
        {/* Background line */}
        <div className="absolute top-5 left-[12.5%] right-[12.5%] h-[3px] bg-slate-100 -z-10 rounded-full" />
        {/* Active progress line */}
        <div 
          className="absolute top-5 left-[12.5%] h-[3px] bg-[#163B8C] -z-10 transition-all duration-700 ease-in-out rounded-full" 
          style={{ width: `${currentStep * 25}%` }} 
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;
          const isLastAndDone = isLast && isCompleted;

          return (
            <div key={index} className="flex flex-col items-center flex-1 z-10 group cursor-default">
              <div 
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-[3px] transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-[#163B8C] border-[#EEF4FF] text-white shadow-sm' 
                    : isCurrent
                    ? 'bg-white border-[#163B8C] text-[#163B8C] shadow-sm scale-110'
                    : 'bg-white border-slate-200 text-slate-400'
                } ${isLastAndDone ? '!bg-emerald-500 !border-emerald-100' : ''}`}
              >
                {isCompleted || isLastAndDone ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <span className="text-sm sm:text-base font-bold">{index + 1}</span>}
              </div>
              <p className={`mt-4 text-xs sm:text-sm font-bold text-center ${
                isCompleted || isCurrent ? (isLastAndDone ? 'text-emerald-600' : 'text-[#0F172A]') : 'text-slate-400'
              }`}>
                {step.title}
              </p>
              <p className={`hidden sm:block text-[11px] sm:text-xs text-center mt-1 font-medium ${
                isCurrent ? 'text-[#163B8C]' : 'text-slate-500'
              }`}>
                {step.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
