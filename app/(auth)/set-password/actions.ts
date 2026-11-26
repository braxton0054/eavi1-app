"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, hashPassword, resolveSessionRecord } from "@/lib/auth";
import { landingFor } from "@/lib/landing";
import { prisma } from "@/lib/prisma";
import { enforcePasswordSetupRateLimit } from "@/lib/security/auth-rate-limit";
import { RateLimitExceededError } from "@/lib/security/rate-limit";

const MIN_LENGTH = 10;
const MAX_LENGTH = 200;

export async function setInitialPassword(formData: FormData) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await resolveSessionRecord(token) : null;
  const user = session?.user;

  if (!session || !user || user.status !== "ACTIVE") redirect("/login?next=%2Fset-password");
  if (!user.mustChangePassword) redirect(landingFor(user.role));

  try {
    await enforcePasswordSetupRateLimit(user.id);
  } catch (error) {
    redirect(error instanceof RateLimitExceededError ? "/set-password?error=throttled" : "/set-password?error=unavailable");
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) redirect("/set-password?error=short");
  if (password.length > MAX_LENGTH) redirect("/set-password?error=long");
  if (password !== confirm) redirect("/set-password?error=mismatch");

  const passwordHash = await hashPassword(password);
  const changed = await prisma.user.updateMany({
    where: { id: user.id, status: "ACTIVE", mustChangePassword: true },
    data: { passwordHash, mustChangePassword: false },
  });
  if (changed.count !== 1) redirect("/set-password?error=unavailable");

  // Any other session created with the temporary password is no longer trustworthy.
  await prisma.session.deleteMany({ where: { userId: user.id, id: { not: session.id } } });

  redirect(landingFor(user.role));
}
