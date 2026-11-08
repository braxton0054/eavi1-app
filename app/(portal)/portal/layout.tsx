import type { Metadata } from "next";
import { connection } from "next/server";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { mobileNav, navGroups, shell, tutorNavGroups } from "@/lib/content/dashboard";
import { requirePortalUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * Chat has its own layout because it is the one screen every role shares.
 *
 * The college portal is admin-only and the tutor portal is tutor-only, so a student would be
 * turned away by either. Here the shell is drawn from whatever the caller actually is, which is
 * also what decides which navigation they see.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const scope = await requirePortalUser();

  const isTutor = scope.role === "TUTOR";
  const isAdmin = scope.role === "SUPERADMIN" || scope.role === "CAMPUS_ADMIN";

  return (
    <DashboardFrame
      scope={scope}
      home={isAdmin ? "/dashboard" : isTutor ? "/tutor" : "/portal/chat"}
      note={isTutor ? shell.tutorNote : shell.brandNote}
      profileHref={isAdmin ? "/dashboard/profile" : isTutor ? "/tutor/profile" : "/portal/chat"}
      nav={isAdmin ? navGroups : isTutor ? tutorNavGroups : navGroups}
      mobile={isTutor ? mobileNav.tutor : isAdmin ? mobileNav.admin : mobileNav.portal}
    >
      {children}
    </DashboardFrame>
  );
}
