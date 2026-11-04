import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

/**
 * Every screen here reads the session, so it cannot be prerendered into a static shell.
 * The frame streams in behind the boundary and the layout opts out of instant
 * navigation validation rather than pretending the read is static.
 */
export const instant = false;

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardFrame>{children}</DashboardFrame>
    </Suspense>
  );
}
