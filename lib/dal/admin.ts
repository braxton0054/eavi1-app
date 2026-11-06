/**
 * College-wide reads for the super admin only. Each getter resolves the session itself, so a
 * campus office can never reach these rows through a shared helper.
 */

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";

export async function getCampusRegister() {
  await requireSuperAdmin();

  return prisma.campus.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { students: true, tutors: true } },
    },
  });
}

export async function getStaffAccounts() {
  await requireSuperAdmin();

  return prisma.user.findMany({
    where: { role: { in: ["TUTOR", "CAMPUS_ADMIN", "SUPERADMIN"] } },
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      campus: { select: { name: true } },
      tutor: { select: { staffNo: true, department: true } },
    },
  });
}
