import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

/**
 * One receipt or credit note for the signed-in student. Both the student and campus come
 * from the session and must match the Receipt identity before its canonical number is opened.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptNo: string }> },
) {
  const student = await requireStudent();
  const { receiptNo } = await params;
  const numberNormalized = decodeURIComponent(receiptNo).trim().toUpperCase();

  const receipt = await prisma.receipt.findFirst({
    where: { numberNormalized, studentId: student.studentId, campusId: student.campusId },
    select: { number: true, kind: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "No receipt with that number on this account." }, { status: 404 });
  }

  const document = await ensureDocument("RECEIPT", receipt.number);
  if (!document) return NextResponse.json({ error: "Receipt not available." }, { status: 404 });
  const file = receipt.kind === "CREDIT_NOTE" ? "credit-note" : "receipt";
  return pdfResponse(request, await documentPdf(document), `${file}-${receipt.number}`);
}
