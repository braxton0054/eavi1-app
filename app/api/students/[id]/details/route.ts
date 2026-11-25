import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { documentPdf } from "@/lib/statements/document";
import { buildStudentDetailsSvg } from "@/lib/statements/student-details";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A student's enrolment record on A4 — no fee figures, no payment links. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await requireCollegeAdmin();
  const { id } = await context.params;

  const student = await prisma.studentProfile.findFirst({
    where: { id },
    select: {
      id: true,
      admissionNo: true,
      address: true,
      secondarySchool: true,
      birthCertificateUrl: true,
      profilePhotoUrl: true,
      user: { select: { fullName: true, email: true, phone: true } },
      campus: { select: { name: true } },
      application: { select: { grade: true } },
      parentGuardians: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { fullName: true, relationship: true, phone: true, altPhone: true },
      },
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { enrolledAt: "desc" },
        select: {
          program: { select: { name: true, durationMonths: true, type: { select: { name: true } } } },
          period: { select: { name: true } },
        },
      },
    },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const enrollment = student.enrollments[0];
  const guardian = student.parentGuardians[0];
  const svg = buildStudentDetailsSvg({
    fullName: student.user.fullName,
    admissionNo: student.admissionNo,
    program: enrollment?.program.name ?? "—",
    level: enrollment?.program.type.name ?? "—",
    duration: enrollment ? `${enrollment.program.durationMonths} months` : "—",
    intake: enrollment?.period.name ?? "—",
    campus: student.campus.name,
    className: "See class register",
    secondarySchool: student.secondarySchool ?? "—",
    grade: student.application?.grade?.replace(/_/g, " ") ?? "—",
    birthCertificate: student.birthCertificateUrl ? "On file" : "Not provided",
    guardianName: guardian?.fullName ?? "—",
    guardianRelationship: guardian?.relationship ?? "—",
    guardianPhone: guardian?.phone ?? "—",
    guardianAlt: guardian?.altPhone ?? "—",
    phone: student.user.phone ?? "—",
    email: student.user.email ?? "—",
    address: student.address ?? "—",
    preparedOn: formatDate(new Date()),
    reference: student.admissionNo,
    photoUrl: student.profilePhotoUrl ?? undefined,
    logoUrl: `${new URL(request.url).origin}/logo.png`,
  });

  const pdf = await documentPdf([svg], { paper: "a4", title: `Student record — ${student.admissionNo}` });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="student-record-${student.admissionNo.replace(/[^A-Za-z0-9]+/g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
