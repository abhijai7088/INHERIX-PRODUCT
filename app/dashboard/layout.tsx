import type { ReactNode } from "react";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardRouteGate from "@/components/dashboard/DashboardRouteGate";

export default function Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardLayout>
      <DashboardRouteGate>
        {children}
      </DashboardRouteGate>
    </DashboardLayout>
  );
}
