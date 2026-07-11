import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/inherix/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/inherix/card";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; home?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const from = params.from ?? "/dashboard";
  const home = params.home ?? "/dashboard";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(22,59,140,0.08),_transparent_30%),linear-gradient(180deg,#F5F7FB_0%,#EEF3FA_100%)] px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center justify-center">
        <Card className="w-full border-[#DCE3EC] shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <CardHeader className="space-y-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-rose-700">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Access denied</span>
            </div>
            <CardTitle className="text-3xl text-[#0F172A]">This area is not available for your role</CardTitle>
            <CardDescription className="text-base leading-7">
              The platform blocked the page at the routing layer because your account does not have permission for this surface.
              This keeps customer, officer, admin, and super-admin workflows properly separated.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-[24px] border border-[#E5ECF5] bg-[#F8FAFC] p-4 text-sm leading-6 text-slate-600">
              <p className="font-medium text-[#0F172A]">Requested route</p>
              <p className="mt-1 break-all">{from}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={home}>
                  <Home className="h-4 w-4" />
                  Go to your dashboard
                </Link>
              </Button>

              <Button asChild variant="outline">
                <Link href="/onboarding/login">
                  <ArrowLeft className="h-4 w-4" />
                  Sign in again
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
