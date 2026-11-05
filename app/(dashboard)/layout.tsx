import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { requireCollegeAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

async function DashboardContent({ children }: { children: React.ReactNode }) {
  const scope = await requireCollegeAdmin();
  return <DashboardFrame scope={scope}>{children}</DashboardFrame>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}
