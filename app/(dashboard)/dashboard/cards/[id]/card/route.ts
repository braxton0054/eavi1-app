import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The saved card, viewable inline and downloadable with `?download`.
 *
 * The card row was created at enrolment and its document was saved then; this route only
 * loads it. A campus check still gates the file, because a serial is a borrowed identifier
 * and the route takes one from the URL.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const scope = await requireCollegeAdmin();
  const { id } = await context.params;
  const card = await prisma.idCard.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { id: true, serial: true },
  });
  if (!card) return new Response("Not found", { status: 404 });

  const document = await ensureDocument("ID_CARD", card.id);
  if (!document) return new Response("Card not available", { status: 404 });

  return pdfResponse(request, await documentPdf(document), `id-card-${card.serial}`);
}
