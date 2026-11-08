import type { Metadata } from "next";
import { connection } from "next/server";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { requireStudent } from "@/lib/session";
import { mobileNav, shell, studentNavGroups } from "@/lib/content/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Student portal",
  robots: { index: false, follow: false },
};

/**
 * The student's side of the portal. As with the tutor portal, the scope comes from the
 * session, so a streaming fallback could only ever be an empty shell and there is no
 * `loading.tsx` boundary here.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const scope = await requireStudent();

  return (
    <DashboardFrame
      scope={scope}
      home="/student"
      note={shell.studentNote}
      profileHref="/student/profile"
      nav={studentNavGroups}
      mobile={mobileNav.student}
    >
      {children}
    </DashboardFrame>
  );
}
