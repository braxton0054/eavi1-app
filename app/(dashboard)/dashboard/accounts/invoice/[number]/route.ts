import { NextResponse } from "next/server";

import { getInvoiceDocument } from "@/lib/dal/fee-documents";
import { requireCollegeAdmin } from "@/lib/session";
import { pdfResponse } from "@/lib/statements/document";
import { invoicePdf } from "@/lib/statements/issue";

/**
 * One invoice, as the administration prints it.
 *
 * The decided mapping: the college has a single money-document design, and an invoice is
 * that design filled from one invoice record — the invoice number in the reference slot,
 * its lines in the four item rows (anything past the fourth becomes an "Other charges"
 * line), the payments applied to it, its total and its outstanding balance. Scoped to the
 * acting administrator's campus.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { number } = await params;

  const document = await getInvoiceDocument(decodeURIComponent(number), scope.campusId);
  if (!document) {
    return NextResponse.json({ error: "No invoice with that number on this campus." }, { status: 404 });
  }

  const file = await invoicePdf({
    invoiceNo: document.invoiceNo,
    invoiceDate: document.invoiceDate,
    student: document.student,
    items: document.items,
    total: document.total,
    paid: document.paid,
    balance: document.balance,
    receivedBy: scope.fullName,
  });

  return pdfResponse(request, file, `invoice-${document.invoiceNo}`);
}
