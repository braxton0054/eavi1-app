import { NextResponse } from "next/server";

import { getStudentFees } from "@/lib/dal/student-portal";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

/**
 * One saved invoice for the signed-in student. The number is resolved against this
 * student's own ledger first, so guessing somebody else's number cannot open their bill.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const wanted = decodeURIComponent(number).trim().toLowerCase();
  const { invoices } = await getStudentFees();
  const invoice = invoices.find((row) => row.number.toLowerCase() === wanted);
  if (!invoice) {
    return NextResponse.json({ error: "No invoice with that number on this account." }, { status: 404 });
  }

  const document = await ensureDocument("INVOICE", invoice.id);
  if (!document) return NextResponse.json({ error: "Invoice not available." }, { status: 404 });
  return pdfResponse(request, await documentPdf(document), `invoice-${invoice.number}`);
}
