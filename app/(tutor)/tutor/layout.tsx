import type { Metadata } from "next";
import { connection } from "next/server";

import { AppShell } from "@/components/shell/app-shell";
import { signOut } from "@/lib/actions/auth";
import { requireTutor } from "@/lib/session";
import { mobileNav, shell, tutorNavGroups } from "@/lib/content/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tutor portal",
  robots: { index: false, follow: false },
};

/**
 * The same rule as the college portal: the tutor's scope comes from a cookie, so a
 * streaming fallback could only ever be the empty shell. No `loading.tsx` boundary here.
 */
export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const scope = await requireTutor();

  return (
    <AppShell
      scope={scope}
      home="/tutor"
      note={shell.tutorNote}
      profileHref="/tutor/profile"
      nav={tutorNavGroups}
      mobile={mobileNav.tutor}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
