import { NextResponse } from "next/server";

import { getReceiptDocument } from "@/lib/dal/fee-documents";
import { requireCollegeAdmin } from "@/lib/session";
import { pdfResponse } from "@/lib/statements/document";
import { receiptPdf } from "@/lib/statements/issue";

/**
 * A fee receipt as the administration prints it.
 *
 * The same template and builder the student portal uses, scoped to the acting
 * administrator's campus instead of to the student session — one receipt number can span
 * several payment rows, and all of them print as one document. Nothing is stored, so a
 * reprint is a re-derivation from the payments table rather than a stale file.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptNo: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { receiptNo } = await params;

  const document = await getReceiptDocument(decodeURIComponent(receiptNo), scope.campusId);
  if (!document) {
    return NextResponse.json({ error: "No receipt with that number on this campus." }, { status: 404 });
  }

  const file = await receiptPdf({
    receiptNo: document.receiptNo,
    receiptDate: document.receiptDate,
    student: document.student,
    items: document.items,
    amountPaid: document.amountPaid,
    totalFees: document.totals.totalFees,
    paidToDate: document.totals.paidToDate,
    balance: document.totals.balance,
    method: document.method,
    reference: document.reference,
    // The cashier who took the money is the person printing the paper, when it is reprinted
    // later the office is what signs it.
    receivedBy: scope.fullName,
  });

  return pdfResponse(request, file, `receipt-${document.receiptNo}`);
}
