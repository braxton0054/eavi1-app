import { getStudentCard } from "@/lib/dal/student-portal";
import { documentPdf, ensureDocument } from "@/lib/documents/service";
import { pdfResponse } from "@/lib/statements/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in student's saved card, inline for viewing and `?download` for a copy. */
export async function GET(request: Request) {
  const { card } = await getStudentCard();
  if (!card || card.status !== "ISSUED" || card.issuedAt === null) {
    return new Response("No issued card is available.", { status: 404 });
  }
  const document = await ensureDocument("ID_CARD", card.id);
  if (!document) return new Response("Card not available", { status: 404 });
  return pdfResponse(request, await documentPdf(document), `id-card-${card.serial}`);
}
