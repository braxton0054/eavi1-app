import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One saved invoice, scoped to the acting administrator's campus. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { number } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: {
      number: decodeURIComponent(number),
      ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
    },
    select: { id: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "No invoice with that number on this campus." }, { status: 404 });
  }

  const document = await ensureDocument("INVOICE", invoice.id);
  if (!document) return NextResponse.json({ error: "Invoice not available." }, { status: 404 });
  return pdfResponse(request, await documentPdf(document), `invoice-${number}`);
}
