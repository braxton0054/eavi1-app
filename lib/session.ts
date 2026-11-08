import { SESSION_COOKIE, resolveSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shell } from "@/lib/content/dashboard";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Roles that may open the college-admin dashboard. A super admin sees every campus
 * (campusId null); a campus admin is locked to their own.
 */
const ADMIN_ROLES = ["CAMPUS_ADMIN", "SUPERADMIN"] as const;

/** The campus a super admin has chosen to work in; absent or "all" means college-wide. */
export const SCOPE_COOKIE = "eavi_scope";

export type AdminScope = {
  userId: string;
  fullName: string;
  email: string;
  role: (typeof ADMIN_ROLES)[number];
  /** The administrator's own picture, read by the header and the profile screen. */
  photoUrl: string | null;
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

  if (user.role === "SUPERADMIN") {
    const chosen = (await cookies()).get(SCOPE_COOKIE)?.value;
    const campus = chosen && /^\d+$/.test(chosen)
      ? await prisma.campus.findUnique({ where: { id: Number(chosen) }, select: { id: true, name: true } })
      : null;
    return {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: "SUPERADMIN",
      photoUrl: user.photoUrl ?? null,
      campusId: campus?.id ?? null,
      campusName: campus?.name ?? shell.allCampuses,
    };
  }

  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as (typeof ADMIN_ROLES)[number],
    photoUrl: user.photoUrl ?? null,
    campusId: user.campusId,
    campusName: user.campus?.name ?? shell.allCampuses,
  };
}

/**
 * Any signed-in person with a usable account: admin, tutor or student.
 *
 * Chat is open to the whole school, so it cannot sit behind `requireCollegeAdmin`, which sends
 * everyone below admin away. Everything campus-scoped stays on the admin paths; this hands back
 * only what a shared screen needs to draw its shell.
 */
export type PortalScope = {
  userId: string;
  fullName: string;
  email: string;
  role: "SUPERADMIN" | "CAMPUS_ADMIN" | "TUTOR" | "STUDENT";
  photoUrl: string | null;
  campusId: number | null;
  campusName: string;
};

export async function requirePortalUser(): Promise<PortalScope> {
  const user = await signedInUser();
  if (!user) redirect("/login?next=%2Fportal%2Fchat");
  if (user.status !== "ACTIVE") redirect("/unavailable");

  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as PortalScope["role"],
    photoUrl: user.photoUrl ?? null,
    campusId: user.campusId,
    campusName: user.campus?.name ?? shell.allCampuses,
  };
}

/** `where` fragment that keeps every query inside the admin's own campus. */
export function campusWhere(campusId: number | null) {
  return campusId === null ? {} : { campusId };
}

/**
 * Reads the session and proves the caller is a super admin. College-wide registers such as
 * campuses and accounts are managed from here; campus staff never reach this screen.
 */
export async function requireSuperAdmin(): Promise<AdminScope> {
  const user = await signedInUser();
  if (!user) redirect("/login?next=%2Fdashboard");
  if (user.role !== "SUPERADMIN") redirect("/unavailable");

  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: "SUPERADMIN",
    photoUrl: user.photoUrl ?? null,
    campusId: user.campusId,
    campusName: user.campus?.name ?? shell.allCampuses,
  };
}

export type TutorScope = {
  userId: string;
  fullName: string;
  email: string;
  role: "TUTOR";
  photoUrl: string | null;
  /** The teaching record every timetable, exam and mark row hangs off. */
  tutorId: string;
  staffNo: string;
  department: string | null;
  campusId: number;
  campusName: string;
};

/**
 * Reads the session, proves the caller is a tutor and hands back their teaching record.
 * A tutor without one could only be shown an empty screen, so that account is refused.
 */
export async function requireTutor(): Promise<TutorScope> {
  const user = await signedInUser();
  if (!user) redirect("/login?next=%2Ftutor");

  if (user.role !== "TUTOR") redirect("/unavailable");

  // Self-registration creates a user with no teaching record; nothing here could be scoped.
  const profile = await prisma.tutorProfile.findUnique({
    where: { userId: user.id },
    include: { campus: { select: { name: true } } },
  });
  if (!profile) redirect("/unavailable?reason=unassigned");

  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: "TUTOR",
    photoUrl: user.photoUrl ?? null,
    tutorId: profile.id,
    staffNo: profile.staffNo,
    department: profile.department,
    campusId: profile.campusId,
    campusName: profile.campus.name,
  };
}

export type StudentScope = {
  userId: string;
  fullName: string;
  email: string;
  role: "STUDENT";
  photoUrl: string | null;
  studentId: string;
  admissionNo: string;
  campusId: number;
  campusName: string;
};

/**
 * Reads the session, proves the caller is a student and hands back their student record.
 *
 * A student account without a student record is an applicant who registered but has not been
 * admitted yet: there is no enrolment, no units and nothing to bill, so the portal shows them
 * their application instead of an empty dashboard. That is refused here rather than by
 * rendering blank panels, so the screen they see is deliberate.
 */
export async function requireStudent(): Promise<StudentScope> {
  const user = await signedInUser();
  if (!user) redirect("/login?next=%2Fstudent");

  if (user.role !== "STUDENT") redirect("/unavailable");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { campus: { select: { name: true } } },
  });
  if (!profile) redirect("/unavailable?reason=notadmitted");

  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: "STUDENT",
    photoUrl: user.photoUrl ?? null,
    studentId: profile.id,
    admissionNo: profile.admissionNo,
    campusId: profile.campusId,
    campusName: profile.campus.name,
  };
}
