import { prisma } from "@/lib/prisma";

import { buildFeeStructureSvg, type FeeStructureInput } from "./fee-structure";

/**
 * The active published plan is the only source of fee figures. Retired versions stay on old
 * invoices, but the fee structure document always shows the plan a new applicant joins.
 */
export async function feeStructureForProgram(programId: string): Promise<{
  svg: string;
  input: FeeStructureInput;
} | null> {
  const program = await prisma.program.findFirst({
    where: { id: programId, archivedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      durationMonths: true,
      type: { select: { name: true } },
      feePlans: {
        where: { isActive: true },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          version: true,
          totalAmount: true,
          createdAt: true,
          periods: { orderBy: { sequence: "asc" }, select: { label: true, amount: true, yearIndex: true, semesterNo: true } },
        },
      },
    },
  });
  if (!program) return null;

  const plan = program.feePlans[0];
  if (!plan || plan.periods.length === 0) return null;

  const input: FeeStructureInput = {
    programName: program.name,
    programCode: program.code,
    level: program.type.name,
    durationMonths: program.durationMonths,
    version: plan.version,
    issuedOn: plan.createdAt.toISOString().slice(0, 10),
    periods: plan.periods.map((period) => ({
      label: period.label,
      amount: Number(period.amount.toString()),
      yearIndex: period.yearIndex,
      semesterNo: period.semesterNo,
    })),
  };

  return { svg: buildFeeStructureSvg(input), input };
}
