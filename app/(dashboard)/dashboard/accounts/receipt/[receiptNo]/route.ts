import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One receipt or credit note, authorized through its Receipt identity and campus. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptNo: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { receiptNo } = await params;
  const numberNormalized = decodeURIComponent(receiptNo).trim().toUpperCase();

  const receipt = await prisma.receipt.findFirst({
    where: {
      numberNormalized,
      ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
    },
    select: { number: true, kind: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "No receipt with that number on this campus." }, { status: 404 });
  }

  const document = await ensureDocument("RECEIPT", receipt.number);
  if (!document) return NextResponse.json({ error: "Receipt not available." }, { status: 404 });
  const file = receipt.kind === "CREDIT_NOTE" ? "credit-note" : "receipt";
  return pdfResponse(request, await documentPdf(document), `${file}-${receipt.number}`);
}
