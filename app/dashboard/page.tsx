"use client";

import Link from "next/link";
import { Activity, Bell, Calendar, ChevronRight, Download, Lock, Shield, ShieldAlert, ShieldCheck, UserPlus, Users, FileText, CheckCircle2, AlertTriangle, AlertCircle, Share2, PlusCircle, ArrowRight, History } from "lucide-react";

import { useRecordsStore } from "@/components/dashboard/RecordsProvider";

export default function DashboardPage() {
  // DashboardRouteGate (parent layout) already guarantees only CUSTOMER role reaches this page
  // Use real data from the provider
  const { nominees, records, dashboardStats } = useRecordsStore();
  const verifiedNomineesCount = nominees.filter(n => n.status === "ACTIVE").length;
  const protectedRecordsCount = records.filter(r => !r.softDeleted).length;
  
  // Base continuity score calculation
  const baseScore = 20; // Start with 20 just for having an account
  const rulesScore = (dashboardStats?.activeRulesCount || 0) * 10;
  const nomineesScore = verifiedNomineesCount * 15;
  const recordsScore = protectedRecordsCount * 2;
  const rawScore = baseScore + rulesScore + nomineesScore + recordsScore;
  const continuityScore = Math.min(100, rawScore);
  const isProtected = continuityScore > 50;

  const readinessScore = Math.min(100, (verifiedNomineesCount > 0 ? 50 : 0) + (protectedRecordsCount > 0 ? 50 : 0));
  const readinessRemaining = (verifiedNomineesCount > 0 ? 0 : 1) + (protectedRecordsCount > 0 ? 0 : 1);
  const emergencyReady = (dashboardStats?.activeRulesCount || 0) > 0;
  const lastActivityDate = dashboardStats?.recentActivity?.[0]?.createdAt 
    ? new Date(dashboardStats.recentActivity[0].createdAt).toLocaleDateString() 
    : "Never";

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#031539] via-[#0A2665] to-[#12429F] p-5 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 bottom-0 w-1/3 bg-[url('/grid-pattern.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div className="min-w-0 flex-1">
            <p className="text-blue-200 text-sm font-medium">Welcome back 👋</p>
            <h1 className="mt-2 text-[24px] sm:text-[32px] font-bold tracking-tight text-white flex items-center gap-3 flex-wrap">
              Your Family Continuity is {isProtected ? "Protected" : "At Risk"}.
              {isProtected ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400 fill-emerald-400/20 shrink-0" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-400 fill-amber-400/20 shrink-0" />
              )}
            </h1>
            <p className="mt-2 text-blue-100 text-sm">Ensure your family can access what matters most, when it matters.</p>
            
            <div className="mt-6 grid grid-cols-2 sm:flex sm:flex-row items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-300 shrink-0" />
                <div>
                  <p className="text-xl font-bold">{verifiedNomineesCount}</p>
                  <p className="text-xs text-blue-200">Verified Nominees</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-300 shrink-0" />
                <div>
                  <p className="text-xl font-bold">{protectedRecordsCount}</p>
                  <p className="text-xs text-blue-200">Protected Records</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className={`h-5 w-5 shrink-0 ${isProtected ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <p className={`text-xl font-bold ${isProtected ? 'text-emerald-400' : 'text-amber-400'}`}>{continuityScore}%</p>
                  <p className="text-xs text-blue-200">Continuity Score</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {dashboardStats?.activeRulesCount ? (
                  <>
                    <Shield className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-400">Emergency</p>
                      <p className="text-xs text-blue-200">Access Ready</p>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-400">Emergency</p>
                      <p className="text-xs text-blue-200">No Rules Setup</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="hidden lg:block relative mr-8 shrink-0">
            <div className="w-[120px] h-[120px] rounded-2xl bg-gradient-to-tr from-blue-400/20 to-blue-200/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
              <div className="text-blue-300 transform scale-150 drop-shadow-[0_0_15px_rgba(147,197,253,0.5)]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Main Content Area (Left) */}
        <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
          {/* Top 4 Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
            {/* Score */}
            <div className="rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Family Continuity Score</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border-4 border-slate-100">
                    <svg className={`absolute inset-0 h-full w-full -rotate-90 ${continuityScore > 50 ? 'text-[#163B8C]' : 'text-amber-500'}`} viewBox="0 0 36 36">
                      <path strokeDasharray={`${continuityScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    </svg>
                    <span className={`text-sm font-bold ${continuityScore > 50 ? 'text-[#163B8C]' : 'text-amber-600'}`}>{continuityScore}%</span>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${continuityScore > 75 ? 'text-emerald-600' : continuityScore > 40 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {continuityScore > 75 ? "Excellent" : continuityScore > 40 ? "Good" : "Needs Action"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {continuityScore > 75 ? "You are doing\ngreat!" : "Take action to\nimprove score"}
                    </p>
                  </div>
                </div>
              </div>
              <Link href="/dashboard/activation" className="mt-4 text-sm font-semibold text-[#163B8C] flex items-center hover:underline">
                View Details <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            {/* Readiness */}
            <div className="rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Family Readiness</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border-4 border-slate-100">
                    <svg className={`absolute inset-0 h-full w-full -rotate-90 ${readinessScore === 100 ? 'text-emerald-500' : 'text-amber-500'}`} viewBox="0 0 36 36">
                      <path strokeDasharray={`${readinessScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    </svg>
                    <span className={`text-sm font-bold ${readinessScore === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{readinessScore}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{readinessRemaining} actions remaining</p>
                    <p className="text-xs text-slate-500 leading-snug mt-1">
                      {readinessScore === 100 ? "Ready for anything." : "Complete missing items."}
                    </p>
                  </div>
                </div>
              </div>
              <Link href="/dashboard/tasks" className="mt-4 text-sm font-semibold text-[#163B8C] flex items-center hover:underline">
                View Readiness <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            {/* Emergency */}
            <div className="rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Emergency Readiness</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className={`flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full ${emergencyReady ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                    {emergencyReady ? (
                      <ShieldCheck className="h-7 w-7 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="h-7 w-7 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${emergencyReady ? 'text-emerald-600' : 'text-amber-600'}`}>{emergencyReady ? 'Ready' : 'Not Setup'}</p>
                    <p className="text-xs text-slate-500 leading-snug mt-1">
                      {emergencyReady ? "Your family can access info." : "Missing active rules."}
                    </p>
                  </div>
                </div>
              </div>
              <Link href="/dashboard/emergency" className="mt-4 text-sm font-semibold text-[#163B8C] flex items-center hover:underline">
                View Access Plan <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            {/* Last Verification */}
            <div className="rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Last Activity</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-100">
                    <Calendar className="h-7 w-7 text-[#163B8C]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{lastActivityDate}</p>
                    <p className="text-xs text-slate-500 leading-snug mt-1">Most recent<br/>interaction.</p>
                  </div>
                </div>
              </div>
              <Link href="/dashboard/logs" className="mt-4 text-sm font-semibold text-[#163B8C] flex items-center hover:underline">
                View Activity <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Family Readiness Overview */}
            <div className="col-span-1 rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col">
              <h3 className="text-base font-semibold text-slate-800">Family Readiness Overview</h3>
              <div className="mt-4 flex flex-col items-center flex-1">
                <div className="relative flex h-[100px] w-[100px] shrink-0 items-center justify-center rounded-full border-[8px] border-slate-100">
                  <svg className={`absolute inset-0 h-full w-full -rotate-90 ${readinessScore === 100 ? 'text-emerald-500' : 'text-[#163B8C]'}`} viewBox="0 0 36 36">
                    <path strokeDasharray={`${readinessScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="8" />
                  </svg>
                  <span className={`text-xl font-bold ${readinessScore === 100 ? 'text-emerald-500' : 'text-[#163B8C]'}`}>{readinessScore}%</span>
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm font-bold text-slate-800">Overall Status</p>
                  <p className="text-xs text-slate-500 mt-1">{readinessScore === 100 ? "Fully Prepared" : "Good Progress"}</p>
                </div>

                <div className="mt-5 w-full space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    {verifiedNomineesCount > 0 ? (
                      <><div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Nominees</div><span className="text-slate-500">{verifiedNomineesCount} verified</span></>
                    ) : (
                      <><div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Nominees</div><span className="text-slate-500">Not Added</span></>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    {dashboardStats?.activeRulesCount ? (
                      <><div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Access Rules</div><span className="text-slate-500">{dashboardStats.activeRulesCount} active</span></>
                    ) : (
                      <><div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Access Rules</div><span className="text-slate-500">Not Added</span></>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    {protectedRecordsCount > 0 ? (
                      <><div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Secure Records</div><span className="text-slate-500">{protectedRecordsCount} items</span></>
                    ) : (
                      <><div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Secure Records</div><span className="text-slate-500">Not Added</span></>
                    )}
                  </div>
                  
                  {records.some(r => r.categorySlug?.toLowerCase().includes("financial") || r.categorySlug?.toLowerCase().includes("bank")) ? (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Financial Assets</div>
                      <span className="text-slate-500">Added</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Financial Assets</div>
                      <span className="text-slate-500">Not Added</span>
                    </div>
                  )}

                  {records.some(r => r.categorySlug?.toLowerCase().includes("will") || r.title?.toLowerCase().includes("will")) ? (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Will Document</div>
                      <span className="text-slate-500">Added</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Will Document</div>
                      <span className="text-slate-500">Not Added</span>
                    </div>
                  )}

                  {records.some(r => r.categorySlug?.toLowerCase().includes("attorney") || r.title?.toLowerCase().includes("attorney")) ? (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Power of Attorney</div>
                      <span className="text-slate-500">Added</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Power of Attorney</div>
                      <span className="text-slate-500">Not Added</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Activity className="h-3 w-3" /> Updated dynamically
                </div>
                <Link href="/dashboard/tasks" className="text-sm font-semibold text-[#163B8C] hover:underline">
                  Continue Setup &rarr;
                </Link>
              </div>
            </div>

            {/* AI Advisor Insights */}
            <div className="col-span-1 lg:col-span-1 rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">AI Advisor Insights</h3>
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-[#163B8C]">New</span>
              </div>
              <div className="mt-4 flex-1 space-y-4">
                {!records.some(r => r.categorySlug?.toLowerCase().includes("insurance") || r.title?.toLowerCase().includes("insurance")) ? (
                  <div className="flex items-start gap-3 rounded-xl border border-blue-50 bg-[#FAFCFF] p-3">
                    <FileText className="h-4 w-4 shrink-0 text-[#163B8C] mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-700 leading-snug">You have no insurance records securely backed up for your family.</p>
                      <Link href="/dashboard/records" className="mt-1.5 inline-block text-xs font-semibold text-[#163B8C] hover:underline">Add Insurance Documents &rarr;</Link>
                    </div>
                  </div>
                ) : null}

                {!records.some(r => r.categorySlug?.toLowerCase().includes("attorney") || r.title?.toLowerCase().includes("attorney")) ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-50 bg-amber-50/30 p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-700 leading-snug">Power of Attorney is missing. This is important to avoid legal delays.</p>
                      <Link href="/dashboard/records" className="mt-1.5 inline-block text-xs font-semibold text-[#163B8C] hover:underline">Add Document &rarr;</Link>
                    </div>
                  </div>
                ) : null}

                {verifiedNomineesCount > 0 ? (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-50 bg-emerald-50/30 p-3">
                    <Lock className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-700 leading-snug">Great job! Your emergency contacts are complete and up to date.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-50 bg-amber-50/30 p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-700 leading-snug">You haven't verified any nominees yet. Please invite a trusted contact.</p>
                      <Link href="/dashboard/family/invite" className="mt-1.5 inline-block text-xs font-semibold text-[#163B8C] hover:underline">Invite Nominee &rarr;</Link>
                    </div>
                  </div>
                )}

              </div>
              <div className="mt-4 pt-2">
                <Link href="/dashboard" className="text-sm font-semibold text-[#163B8C] flex items-center hover:underline">
                  View All Insights <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Continuity Timeline */}
            <div className="col-span-1 rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">Continuity Timeline</h3>
                <Link href="/dashboard/logs" className="text-xs font-semibold text-[#163B8C] bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100">
                  View All
                </Link>
              </div>
              <div className="mt-4 flex-1 relative pl-3">
                <div className="absolute left-[19px] top-2 bottom-6 w-px bg-slate-100"></div>
                
                <div className="space-y-5">
                  {dashboardStats?.recentActivity && dashboardStats.recentActivity.length > 0 ? (
                    dashboardStats.recentActivity.slice(0, 5).map((activity, index) => {
                      const date = new Date(activity.createdAt);
                      let colorClass = "bg-blue-500";
                      if (activity.action.includes("CREATE")) colorClass = "bg-emerald-500";
                      else if (activity.action.includes("UPDATE")) colorClass = "bg-amber-500";
                      else if (activity.action.includes("DELETE") || activity.action.includes("REVOKE")) colorClass = "bg-red-500";
                      
                      return (
                        <div key={activity.id} className="relative flex items-start gap-3">
                          <div className={`relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${colorClass} border-2 border-white shadow-sm mt-0.5`}></div>
                          <div>
                            <p className="text-sm font-medium text-slate-800 capitalize">
                              {activity.action.toLowerCase().replace(/_/g, ' ')} {activity.entityType?.toLowerCase()}
                            </p>
                            <p className="text-xs text-slate-400">
                              {date.toLocaleDateString()} &bull; {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 italic">No recent activity.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Banner */}
          <div className="relative overflow-hidden rounded-[16px] bg-[#EEF2F9] p-6 pb-0 border border-slate-200">
            <h3 className="text-lg font-bold tracking-tight text-[#0A1A3A]">Built For Families. Trusted For Generations.</h3>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 relative z-10">
              <div className="flex gap-2">
                <Lock className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Bank-level Security</p>
                  <p className="text-xs text-slate-500 mt-1">256-bit encryption</p>
                </div>
              </div>
              <div className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Complete Privacy</p>
                  <p className="text-xs text-slate-500 mt-1">Zero-knowledge architecture</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Activity className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Always Available</p>
                  <p className="text-xs text-slate-500 mt-1">99.9% uptime commitment</p>
                </div>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Designed For Legacy</p>
                  <p className="text-xs text-slate-500 mt-1">Secure today, accessible tomorrow</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0 space-y-4 sm:space-y-6">
          
          {/* Security Center */}
          <div className="rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Security Center</h3>
              <Link href="/dashboard/security" className="text-xs text-slate-500 hover:text-[#163B8C] font-medium">View All</Link>
            </div>
            
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
                    <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Multi-layer Encryption</p>
                    <p className="text-xs text-slate-500 mt-1">AES-256 &bull; End-to-End</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Two-factor Authentication</p>
                    <p className="text-xs text-slate-500 mt-1">TOTP &bull; Biometric Login</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 border border-blue-100">
                    <Activity className="h-3.5 w-3.5 text-[#163B8C]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Device Security</p>
                    <p className="text-xs text-slate-500 mt-1">3 devices active</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#163B8C]">View</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 border border-blue-100">
                    <History className="h-3.5 w-3.5 text-[#163B8C]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Login Activity</p>
                    <p className="text-xs text-slate-500 mt-1">No suspicious activity</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#163B8C]">View</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 border border-blue-100">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#163B8C]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Last Security Check</p>
                    <p className="text-xs text-slate-500 mt-1">{lastActivityDate}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#163B8C]">View</span>
              </div>
            </div>

            <Link href="/dashboard/security" className="mt-5 flex w-full justify-center items-center gap-1 rounded bg-[#F8FAFC] py-2 text-sm font-semibold text-[#163B8C] hover:bg-[#EEF2F9] transition">
              Go to Security Center &rarr;
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="rounded-[16px] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100">
            <h3 className="text-base font-semibold text-slate-800 mb-3">Quick Actions</h3>
            
            <div className="space-y-1">
              <Link href="/dashboard/records" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#F8FAFC] hover:text-[#163B8C] transition">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-3.5 w-3.5" /> Upload Document
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link href="/dashboard/family" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#F8FAFC] hover:text-[#163B8C] transition">
                <div className="flex items-center gap-2.5">
                  <UserPlus className="h-3.5 w-3.5" /> Add Nominee
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link href="/dashboard/records" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#F8FAFC] hover:text-[#163B8C] transition">
                <div className="flex items-center gap-2.5">
                  <Share2 className="h-3.5 w-3.5" /> Share Vault
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link href="/dashboard/emergency" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#F8FAFC] hover:text-[#163B8C] transition">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Create Emergency Access
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link href="/dashboard/tasks" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#F8FAFC] hover:text-[#163B8C] transition">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-3.5 w-3.5" /> Generate Instruction
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
              <Link href="/dashboard/backup" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#F8FAFC] hover:text-[#163B8C] transition">
                <div className="flex items-center gap-2.5">
                  <Download className="h-3.5 w-3.5" /> Download My Plan
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
