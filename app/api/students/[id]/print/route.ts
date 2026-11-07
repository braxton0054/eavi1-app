import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getStudent } from "@/lib/dal/college";
import { SESSION_COOKIE } from "@/lib/auth";
import { renderPdf } from "@/lib/print/pdf";

/**
 * The student record as a print-ready PDF.
 *
 * The PDF is generated from the page this admin is already allowed to see, using their own
 * session cookie, so the campus scope check runs exactly as it does on screen. Nothing is
 * read from the request except the student id, and a student outside the signed-in campus's
 * scope throws `not_found` before any browser is launched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let student: Awaited<ReturnType<typeof getStudent>>;
  try {
    student = await getStudent(id);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }
    throw error;
  }

  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Print the page the admin would see, on this origin, with this session.
  const origin = new URL(request.url).origin;
  const pageUrl = `${origin}/dashboard/students/${id}`;

  let pdf: Buffer;
  try {
    pdf = await renderPdf({
      url: pageUrl,
      cookie: { name: SESSION_COOKIE, value: session },
      subject: { fullName: student.user.fullName, admissionNo: student.admissionNo },
    });
  } catch (error) {
    console.error("student print failed", error);
    return NextResponse.json(
      { error: "The PDF could not be generated. Check that a browser is available for printing." },
      { status: 503 },
    );
  }

  const safeName = student.admissionNo.replace(/[\\/:*?"<>|]/g, "-");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` so it opens in the browser's viewer, which always offers a download.
      "Content-Disposition": `inline; filename="student-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
