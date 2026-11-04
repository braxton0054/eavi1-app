import { NextResponse, type NextRequest } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmail, normalizeKenyanPhone } from "@/lib/validation";

const ASSIGNABLE_ROLES = ["STUDENT", "TUTOR", "CAMPUS_ADMIN", "SUPERADMIN"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Self-service students start live; every staff role waits for a superadmin. */
const ROLES_NEEDING_APPROVAL: AssignableRole[] = ["TUTOR", "CAMPUS_ADMIN", "SUPERADMIN"];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { fullName, email, phone, password, confirm } = body as Record<string, unknown>;
  const requestedRole = typeof body.role === "string" ? body.role : "STUDENT";
  const campusId = typeof body.campusId === "number" ? body.campusId : null;

  const fieldErrors: Record<string, string> = {};

  if (typeof fullName !== "string" || fullName.trim().length < 2) {
    fieldErrors.fullName = "Give the name we should call you by.";
  }
  if (typeof email !== "string" || !isEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  const normalizedPhone =
    typeof phone === "string" ? normalizeKenyanPhone(phone) : null;
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
  if (password !== confirm) {
    fieldErrors.confirm = "The two passwords do not match.";
  }

  if (!ASSIGNABLE_ROLES.includes(requestedRole as AssignableRole)) {
    fieldErrors.role = "Choose a role from the list.";
  }

  const role = requestedRole as AssignableRole;
  const needsCampus = role === "TUTOR" || role === "CAMPUS_ADMIN" || role === "STUDENT";
  if (needsCampus && campusId === null) {
    fieldErrors.campusId = "Choose which campus you belong to.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 400 });
  }

  if (campusId !== null) {
    const campus = await prisma.campus.findUnique({ where: { id: campusId } });
    if (!campus) {
      return NextResponse.json(
        { fieldErrors: { campusId: "That campus does not exist." } },
        { status: 400 },
      );
    }
  }

  const passwordHash = await hashPassword(password as string);
  const status = ROLES_NEEDING_APPROVAL.includes(role) ? "PENDING" : "ACTIVE";

  try {
    const user = await prisma.user.create({
      data: {
        fullName: (fullName as string).trim(),
        email: (email as string).trim().toLowerCase(),
        phone: normalizedPhone as string,
        passwordHash,
        role,
        status,
        campusId: role === "SUPERADMIN" ? null : campusId,
      },
      select: { id: true, email: true, role: true, status: true },
    });

    return NextResponse.json(
      {
        id: user.id,
        status: user.status,
        message:
          user.status === "PENDING"
            ? "Registered. A superadmin must approve this account before it can sign in."
            : "Registered. You can sign in now.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { fieldErrors: { email: "That email already has an account." } },
        { status: 409 },
      );
    }
    throw error;
  }
}
