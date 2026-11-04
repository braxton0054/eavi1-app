import { SESSION_COOKIE, resolveSession } from "@/lib/auth";
import { shell } from "@/lib/content/dashboard";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Roles that may open the college-admin dashboard. A super admin sees every campus
 * (campusId null); a campus admin is locked to their own.
 */
const ADMIN_ROLES = ["CAMPUS_ADMIN", "SUPERADMIN"] as const;

export type AdminScope = {
  userId: string;
  fullName: string;
  email: string;
  role: (typeof ADMIN_ROLES)[number];
  /** null means college-wide, which only a super admin can hold. */
  campusId: number | null;
  campusName: string;
};

/** One session lookup per request, shared by the layout, every page and each action. */
const signedInUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(token);
});

export async function getSignIn() {
  const user = await signedInUser();
  if (!user) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    campusId: user.campusId,
    campusName: user.campus?.name ?? null,
  };
}

/**
 * Reads the session, proves the caller is an admin and hands back the campus filter that
 * every query must use. Never take campusId from the client.
 */
export async function requireCollegeAdmin(): Promise<AdminScope> {
  const user = await signedInUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  if (!ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    redirect("/unavailable");
  }

  // A campus admin without a campus could only ever be shown an empty, misleading screen.
  if (user.role === "CAMPUS_ADMIN" && !user.campusId) {
    redirect("/unavailable?reason=unassigned");
  }

  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as (typeof ADMIN_ROLES)[number],
    campusId: user.campusId,
    campusName: user.campus?.name ?? shell.allCampuses,
  };
}

/** `where` fragment that keeps every query inside the admin's own campus. */
export function campusWhere(campusId: number | null) {
  return campusId === null ? {} : { campusId };
}
