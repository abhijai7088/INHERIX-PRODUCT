import {
  ArrowRight,
  ShieldCheck,
  Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pt-36">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_40%)]" />

      <div className="relative mx-auto max-w-7xl px-6">

        <div className="grid items-center gap-20 lg:grid-cols-2">

          <div>

            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-2">

              <ShieldCheck className="h-4 w-4 text-emerald-600" />

              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">

                GOVERNANCE-ORIENTED CONTINUITY INFRASTRUCTURE

              </span>

            </div>

            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">

              Secure your family’s

              <span className="block bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">

                digital continuity.

              </span>

            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-9 text-slate-600">

              INHERIX helps families organize critical information,
              define trusted relationships, and manage access through
              verification-oriented workflows and governance-driven systems.

            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">

<Button className="h-14 rounded-full bg-[#0B1220] px-8 text-white hover:bg-[#111827]">
                Start Continuity Plan

                <ArrowRight className="ml-2 h-4 w-4" />

              </Button>

              <Button
                variant="outline"
                className="h-14 rounded-full border-slate-300 px-8"
              >

                <Play className="mr-2 h-4 w-4" />

                View Platform Preview

              </Button>

            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">

              <div className="rounded-2xl border border-slate-200 bg-white p-4">

                <h4 className="text-sm font-semibold text-slate-900">

                  Verification Workflows

                </h4>

                <p className="mt-1 text-sm text-slate-500">

                  Secure & monitored

                </p>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">

                <h4 className="text-sm font-semibold text-slate-900">

                  Structured Access

                </h4>

                <p className="mt-1 text-sm text-slate-500">

                  Trusted relationships

                </p>

              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">

                <h4 className="text-sm font-semibold text-slate-900">

                  Audit Visibility

                </h4>

                <p className="mt-1 text-sm text-slate-500">

                  Full activity tracking

                </p>

              </div>

            </div>

          </div>


          <div className="relative">

            <div className="overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">

                <div>

                  <p className="text-sm text-slate-500">

                    Continuity Overview

                  </p>

                  <h3 className="mt-1 text-2xl font-semibold text-slate-900">

                    Real-time governance visibility

                  </h3>

                </div>

                <div className="rounded-full bg-emerald-50 px-4 py-2">

                  <span className="text-sm font-medium text-emerald-700">

                    System Active

                  </span>

                </div>

              </div>
              <div className="space-y-6 p-8">
                <div className="rounded-3xl bg-gradient-to-br from-[#0B1220] to-[#111827] p-7 text-white">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-sm text-slate-300">

                        Continuity Readiness

                      </p>

                      <h2 className="mt-3 text-6xl font-semibold">

                        82%

                      </h2>

                      <p className="mt-3 text-sm text-emerald-400">

                        Strong governance visibility

                      </p>

                    </div>

                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-emerald-500/20">

                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-400">

                        <span className="text-sm font-semibold">

                          Strong

                        </span>

                      </div>

                    </div>

                  </div>

                </div>

                <div className="grid grid-cols-2 gap-4">

                  <div className="rounded-3xl border border-slate-100 p-5">

                    <p className="text-sm text-slate-500">

                      Continuity Records

                    </p>

                    <h4 className="mt-2 text-3xl font-semibold text-slate-900">

                      124

                    </h4>

                    <p className="mt-1 text-sm text-slate-400">

                      Organized

                    </p>

                  </div>

                  <div className="rounded-3xl border border-slate-100 p-5">

                    <p className="text-sm text-slate-500">

                      Professional Access

                    </p>

                    <h4 className="mt-2 text-3xl font-semibold text-slate-900">

                      06

                    </h4>

                    <p className="mt-1 text-sm text-slate-400">

                      Trusted

                    </p>

                  </div>

                  <div className="rounded-3xl border border-slate-100 p-5">

                    <p className="text-sm text-slate-500">

                      Verification Status

                    </p>

                    <h4 className="mt-2 text-2xl font-semibold text-slate-900">

                      Verified

                    </h4>

                    <p className="mt-1 text-sm text-slate-400">

                      All clear

                    </p>

                  </div>

                  <div className="rounded-3xl border border-slate-100 p-5">

                    <p className="text-sm text-slate-500">

                      Activity Logs

                    </p>

                    <h4 className="mt-2 text-2xl font-semibold text-slate-900">

                      Live

                    </h4>

                    <p className="mt-1 text-sm text-slate-400">

                      Monitoring

                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}