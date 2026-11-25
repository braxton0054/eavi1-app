import { NextResponse, type NextRequest } from "next/server";

import { limitApplicationLookup } from "@/lib/chat/rate-limit";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Find an applicant's own record from the email or phone they entered on the form.
 *
 * Public by necessity — an applicant has no account — so the response carries only the
 * status and, for their own application, the unguessable letter token. It never lists
 * anyone else's details; to get a record the caller must already know the email or phone.
 */
function callerAddress(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    limitApplicationLookup(callerAddress(request));
  } catch {
    return NextResponse.json({ error: "Too many lookups. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const raw = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (!raw) return NextResponse.json({ status: "none" });

  const email = raw.includes("@") ? raw.toLowerCase() : null;
  const phone = email ? null : normalizeKenyanPhone(raw);

  if (!email && !phone) return NextResponse.json({ status: "none" });

  const application = await prisma.application.findFirst({
    where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      fullName: true,
      program: { select: { id: true, name: true, code: true } },
      campus: { select: { name: true } },
      studentProfile: { select: { id: true } },
      offerLetter: { select: { verifyToken: true } },
    },
  });

  if (!application) return NextResponse.json({ status: "none" });

  // Enrolled applicants are directed to their campus; nothing about the letter is offered.
  if (application.studentProfile) {
    return NextResponse.json({ status: "enrolled", campusName: application.campus.name });
  }

  return NextResponse.json({
    status: "applied",
    reference: application.reference,
    fullName: application.fullName,
    campusName: application.campus.name,
    program: application.program,
    letterUrl: application.offerLetter
      ? `/letter/${encodeURIComponent(application.reference)}?t=${encodeURIComponent(application.offerLetter.verifyToken)}`
      : null,
  });
}
