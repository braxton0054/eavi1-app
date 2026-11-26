import { NextResponse, type NextRequest } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmail, normalizeKenyanPhone } from "@/lib/validation";
import {
  enforceRegistrationRateLimit,
  retryAfterOf,
  unavailableSecurityControls,
} from "@/lib/security/auth-rate-limit";
import { RateLimitExceededError, RateLimitUnavailableError } from "@/lib/security/rate-limit";

/** Public registration is for students only. Staff accounts are provisioned by the college. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (body.role !== undefined && body.role !== "STUDENT") {
    return NextResponse.json({ error: "Staff accounts are created by the college." }, { status: 403 });
  }

  const { fullName, email, phone, password, confirm } = body as Record<string, unknown>;
  const campusId = typeof body.campusId === "number" ? body.campusId : null;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPhone = typeof phone === "string" ? normalizeKenyanPhone(phone) : null;
  const fieldErrors: Record<string, string> = {};

  if (typeof fullName !== "string" || fullName.trim().length < 2) {
    fieldErrors.fullName = "Give the name we should call you by.";
  }
  if (!isEmail(normalizedEmail)) fieldErrors.email = "Enter a valid email address.";
  if (typeof phone !== "string" || phone.trim() === "") {
    fieldErrors.phone = "We reach people by phone first.";
  } else if (!normalizedPhone) {
    fieldErrors.phone = "Use a Kenyan number, for example 0712 345 678.";
  }
  if (typeof password !== "string" || password.length < 8) {
    fieldErrors.password = "Use at least 8 characters.";
  } else if (password.length > 200) {
    fieldErrors.password = "That password is too long.";
  }
  if (password !== confirm) fieldErrors.confirm = "The two passwords do not match.";
  if (campusId === null) fieldErrors.campusId = "Choose which campus you belong to.";

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 400 });
  }

  try {
    await enforceRegistrationRateLimit(request, normalizedEmail, normalizedPhone!);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(unavailableSecurityControls(), { status: 503 });
    }
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many registration attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterOf(error)) } },
      );
    }
    throw error;
  }

  const campus = await prisma.campus.findUnique({ where: { id: campusId! } });
  if (!campus) {
    return NextResponse.json(
      { fieldErrors: { campusId: "That campus does not exist." } },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.create({
      data: {
        fullName: (fullName as string).trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash: await hashPassword(password as string),
        role: "STUDENT",
        status: "ACTIVE",
        campusId,
      },
      select: { id: true, status: true },
    });

    return NextResponse.json(
      { id: user.id, status: user.status, message: "Registered. You can sign in now." },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { fieldErrors: { email: "That email already has an account." } },
        { status: 409 },
      );
    }
    throw error;
  }
}
