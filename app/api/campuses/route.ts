import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const campuses = await prisma.campus.findMany({
    orderBy: { id: "asc" },
    select: { id: true, code: true, name: true, place: true },
  });

  return NextResponse.json(campuses, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  });
}

