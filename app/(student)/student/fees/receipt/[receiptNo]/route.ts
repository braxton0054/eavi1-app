import { NextResponse } from "next/server";

import { getStudentFees } from "@/lib/dal/student-portal";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

/**
 * One saved receipt for the signed-in student. A number is resolved against this student's
 * own payments before the document is loaded — no id from the URL reaches the database
 * unscoped.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptNo: string }> },
) {
  const { receiptNo } = await params;
  const wanted = decodeURIComponent(receiptNo).trim().toLowerCase();
  const { payments } = await getStudentFees();
  const row = payments.find((payment) => (payment.receiptNo ?? "").toLowerCase() === wanted);
  if (!row?.receiptNo) {
    return NextResponse.json({ error: "No receipt with that number on this account." }, { status: 404 });
  }

  const document = await ensureDocument("RECEIPT", row.receiptNo);
  if (!document) return NextResponse.json({ error: "Receipt not available." }, { status: 404 });
  return pdfResponse(request, await documentPdf(document), `receipt-${row.receiptNo}`);
}
