import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One saved receipt, scoped to the acting administrator's campus. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptNo: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { receiptNo } = await params;
  const number = decodeURIComponent(receiptNo);

  const row = await prisma.payment.findFirst({
    where: {
      receiptNo: { equals: number, mode: "insensitive" },
      ...(scope.campusId === null ? {} : { invoice: { campusId: scope.campusId } }),
    },
    select: { receiptNo: true },
  });
  if (!row?.receiptNo) {
    return NextResponse.json({ error: "No receipt with that number on this campus." }, { status: 404 });
  }

  const document = await ensureDocument("RECEIPT", row.receiptNo);
  if (!document) return NextResponse.json({ error: "Receipt not available." }, { status: 404 });
  return pdfResponse(request, await documentPdf(document), `receipt-${row.receiptNo}`);
}
