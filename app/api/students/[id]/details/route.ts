import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A saved student record: enrolment details only, no fees, payments or invoices. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const scope = await requireCollegeAdmin();
  const { id } = await context.params;
  const student = await prisma.studentProfile.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { id: true, admissionNo: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const document = await ensureDocument("STUDENT_PROFILE", student.id);
  if (!document) return NextResponse.json({ error: "Student record not available." }, { status: 404 });
  return pdfResponse(request, await documentPdf(document), `student-record-${student.admissionNo}`);
}
