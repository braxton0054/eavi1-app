import { NextResponse, type NextRequest } from "next/server";

import { requireCollegeAdmin } from "@/lib/session";
import { feeStructureForProgram } from "@/lib/statements/fee-structure-data";
import { buildFeeStructureSvg, feeStructureFilename } from "@/lib/statements/fee-structure";
import { renderAdmissionLetterPdf } from "@/lib/admissions/letter-svg";

export const dynamic = "force-dynamic";

/** The programme's fee structure, generated from its published plan — not an uploaded PDF. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireCollegeAdmin();
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format")?.toLowerCase();

  const document = await feeStructureForProgram(id);
  if (!document) {
    return NextResponse.json({ error: "Publish a fee plan for this programme first." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const svg = buildFeeStructureSvg({ ...document.input, logoUrl: `${origin}/logo.png` });
  const name = feeStructureFilename(document.input.programCode);

  if (format === "pdf") {
    try {
      const pdf = await renderAdmissionLetterPdf(svg);
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${name.replace(/\.svg$/, ".pdf")}"`,
          "Content-Length": String(pdf.byteLength),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return NextResponse.json({ error: "The PDF could not be prepared. Try the SVG." }, { status: 500 });
    }
  }

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
