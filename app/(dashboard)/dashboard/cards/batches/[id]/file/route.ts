import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";

/**
 * Serves a batch's PDF through the portal.
 *
 * The file lives in object storage, but handing the browser the raw storage URL would take
 * the office out of the system and expose the bucket path. Streaming it from here keeps the
 * campus scope check in front of the file and lets the same route back both the inline
 * viewer and the download button.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const scope = await requireCollegeAdmin();

  const batch = await prisma.cardBatch.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { fileUrl: true },
  });

  if (!batch?.fileUrl) return new Response("Not found", { status: 404 });

  const upstream = await fetch(batch.fileUrl);
  if (!upstream.ok) return new Response("Card file unavailable", { status: 502 });

  const bytes = await upstream.arrayBuffer();

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      // Inline so the viewer can show it; the download button names the file instead.
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
