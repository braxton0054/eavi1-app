import { NextResponse } from "next/server";

import { requireCollegeAdmin } from "@/lib/session";
import { documentPdf, ensureDocument } from "@/lib/documents/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The saved fee structure for a programme, inline in the browser or as an SVG.
 *
 * Published plans are the only source. When a super admin edits a fee input the hook on
 * that save marks this document stale and the worker overwrites it; this route just loads
 * what was saved, so a changed plan is reflected without anybody clicking "generate".
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireCollegeAdmin();
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format")?.toLowerCase();

  const document = await ensureDocument("FEE_STRUCTURE", id);
  if (!document) {
    return NextResponse.json({ error: "Publish a fee plan for this programme first." }, { status: 404 });
  }

  if (format === "svg") {
    return new NextResponse(document.svgText, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="${document.fileName.replace(/\.pdf$/, ".svg")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const pdf = await documentPdf(document);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${document.fileName}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
