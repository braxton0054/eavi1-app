"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, hashPassword, resolveSession } from "@/lib/auth";
import { landingFor } from "@/lib/landing";
import { prisma } from "@/lib/prisma";

/** Matches the minimum every other password field in the portal enforces. */
const MIN_LENGTH = 10;

/**
 * Sets the portal password for an account that was still flagged `mustChangePassword`.
 *
 * No current password is asked for, and that is deliberate: the flag exists precisely
 * because the account's password is one the holder did not choose — a temporary string
 * written by the office during enrolment. The authority to set it comes from the session,
 * which in the Google case was just established against a verified address, and in the
 * password case from having signed in with that temporary password already.
 *
 * The flag is cleared in the same write, so the gate cannot be re-entered afterwards.
 */
export async function setInitialPassword(formData: FormData) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? await resolveSession(token) : null;

  // No session, no password change. Nothing outside this page's own flow is exposed.
  if (!user) redirect("/login?next=%2Fset-password");

  // Already done: this page is not a general "change password" screen.
  if (!user.mustChangePassword) redirect(landingFor(user.role));

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) redirect("/set-password?error=short");
  if (password !== confirm) redirect("/set-password?error=mismatch");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });

  redirect(landingFor(user.role));
}
