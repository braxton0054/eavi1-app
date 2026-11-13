import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  // Only campuses that accept registrations belong in the signup dropdown —
  // support locations like the Town Office are excluded (CMP-09: keep choice
  // lists short and meaningful).
  const campuses = await prisma.campus.findMany({
    where: { takesApplicants: true },
    orderBy: { id: "asc" },
    select: { id: true, code: true, name: true, place: true },
  });

  return NextResponse.json(campuses, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  });
}

