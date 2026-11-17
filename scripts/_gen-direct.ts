import "dotenv/config";
import { prisma } from "../lib/prisma";
import { activePlanFor } from "../lib/fees/schedule";
import { generateFeeSchedule } from "../lib/fees/schedule";
import { nextInvoiceNumbers } from "../lib/actions/college/_shared";

async function main() {
  const sp = await prisma.studentProfile.findUnique({
    where: { id: "ff819528-88bc-45b7-8bc0-3146a0f209c1" },
    select: { id: true, campusId: true, enrollments: { where: { status: "ACTIVE" }, select: { id: true, programId: true, campusId: true, enrolledAt: true, period: { select: { startsAt: true } } } } },
  });
  const enrollment = sp!.enrollments[0];
  console.log("enrollment:", enrollment.id, "program:", enrollment.programId);
  const plan = await activePlanFor(enrollment.programId);
  console.log("plan:", plan ? `${plan.id} v${plan.version} periods:${plan.periods.length} total:${plan.totalAmount}` : "NULL");
  if (!plan) return;
  const numbers = await nextInvoiceNumbers(plan.periods.length);
  console.log("numbers reserved:", numbers.length);
  const result = await prisma.$transaction((tx) =>
    generateFeeSchedule(tx, {
      studentId: sp!.id,
      enrollmentId: enrollment.id,
      campusId: enrollment.campusId,
      programId: enrollment.programId,
      startDate: enrollment.period?.startsAt ?? enrollment.enrolledAt,
      numbers,
    }),
  );
  console.log("RESULT:", JSON.stringify(result));
  const inv = await prisma.invoice.count({ where: { enrollmentId: enrollment.id } });
  console.log("invoices now:", inv);
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error("ERR:", e instanceof Error ? e.message.slice(0, 300) : e); process.exit(1); });
