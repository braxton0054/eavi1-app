import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { getCardFace } from "@/lib/dal/cards";
import { renderPdf } from "@/lib/print/pdf";
import { SESSION_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One ID card as a print-ready A4 PDF, built from the card's live face.
 *
 * The artwork is merged from the stored card row and the student's current record each
 * time, so a photo uploaded after the card was issued appears here without regeneration.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const scope = await requireCollegeAdmin();
  const { id } = await context.params;
  const card = await prisma.idCard.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { id: true },
  });
  if (!card) return new Response("Not found", { status: 404 });

  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return new Response("Not signed in", { status: 401 });

  const origin = new URL(request.url).origin;
  const pdf = await renderPdf({
    url: `${origin}/dashboard/cards/${id}/print-view`,
    cookie: { name: SESSION_COOKIE, value: session },
    subject: { fullName: "", admissionNo: id.slice(0, 8) },
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
