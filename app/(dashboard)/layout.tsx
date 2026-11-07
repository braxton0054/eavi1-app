import type { Metadata } from "next";
import { connection } from "next/server";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { mobileNav, navGroups, shell, superNavGroups } from "@/lib/content/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

/**
 * Nothing here is a `loading.tsx` boundary on purpose: the scope lives in a cookie, so a
 * streaming fallback could only ever be the empty shell — and in dev, where each segment
 * streams separately, the boundary never resolved and every portal screen stayed on the
 * skeleton. Routing covers the wait instead; `DashboardSkeleton` is shown by the pages that
 * need it.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const scope = await requireCollegeAdmin();

  // Only a super admin switches campus; a campus admin's scope is fixed on their account.
  const campuses =
    scope.role === "SUPERADMIN"
      ? await prisma.campus.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [];

  return (
    <DashboardFrame
      scope={{ ...scope, campusPicker: scope.role === "SUPERADMIN" ? { campusId: scope.campusId, campuses } : undefined }}
      home="/dashboard"
      note={shell.brandNote}
      profileHref="/dashboard/profile"
      nav={scope.role === "SUPERADMIN" ? superNavGroups : navGroups}
      mobile={mobileNav.admin}
    >
      {children}
    </DashboardFrame>
  );
}
