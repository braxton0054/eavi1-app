import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { requireTutor } from "@/lib/session";
import { mobileNav, shell, tutorNavGroups } from "@/lib/content/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tutor portal",
  robots: { index: false, follow: false },
};

async function TutorContent({ children }: { children: React.ReactNode }) {
  const scope = await requireTutor();
  return (
    <DashboardFrame
      scope={scope}
      home="/tutor"
      note={shell.tutorNote}
      profileHref="/tutor/profile"
      nav={tutorNavGroups}
      mobile={mobileNav.tutor}
    >
      {children}
    </DashboardFrame>
  );
}

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TutorContent>{children}</TutorContent>
    </Suspense>
  );
}
