"use server";

import { InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, labels, pages } from "@/lib/content/dashboard";
import { money } from "@/lib/format";
import {
  FieldError,
  dateField,
  enumField,
  hiddenId,
  nextInvoiceNumber,
  nextInvoiceNumbers,
  nextReceiptNumber,
  onSave,
  requiredDate,
  requiredNumber,
  requiredText,
  text,
  semesterOnCampus,
  unique,
} from "@/lib/actions/college/_shared";
import { activePlanFor, generateFeeSchedule } from "@/lib/fees/schedule";
import { recomputeInvoice } from "@/lib/fees/ledger";
import { allocateStudentPayment } from "@/lib/fees/payment";

const METHODS = Object.keys(PaymentMethod) as (keyof typeof PaymentMethod)[];

/** Labels are read back out of the field descriptors, never retyped here. */
const fieldLabel = (name: string) =>
  pages.accounts.create.fields.find((field) => field.name === name)?.label ??
  pages.accounts.create.lineFields.find((field) => field.name === name)?.label ??
  pages.accounts.payment.fields.find((field) => field.name === name)?.label ??
  name;

/** The number is the only thing the database keeps unique on an invoice. */
const invoiceLabel =
  pages.accounts.invoiceColumns.find((column) => column.key === "number")?.label ?? "number";

/** The table, the overview counters and the student profile all read this. */
const AFFECTED = ["/dashboard/accounts", "/dashboard", "/dashboard/students"];

/** The status of one invoice is recomputed from its own rows after every write. */
const recompute = (invoiceId: string) => recomputeInvoice(prisma, invoiceId);

/** Proves a form-supplied invoice id sits on the admin's campus and returns its owner. */
async function campusInvoice(campusId: number | null, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...(campusId === null ? {} : { campusId }) },
    select: { id: true, status: true, studentId: true },
  });
  if (!invoice) throw new FieldError(fieldErrors.notOnCampus);
  return invoice;
}

export async function createInvoice(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    // A bill has to sit in exactly one campus, so a college-wide admin raises none here.
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const studentId = requiredText(formData, "studentId", fieldLabel("studentId"));
    // The bill is raised against this campus's semester, so a foreign semester id is refused here.
    const semesterId = await semesterOnCampus(formData, "semesterId", campusId);
    const dueAt = dateField(formData, "dueAt");
    const note = text(formData, "note");

    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, campusId },
      select: { id: true },
    });
    if (!student) throw new FieldError(fieldErrors.notOnCampus);

    // The programme is whatever the student is actually studying, not a value off the form.
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, campusId, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: { programId: true },
    });

    const feeItems = enrollment
      ? await prisma.feeItem.findMany({
          where: {
            programId: enrollment.programId,
            isOptional: false,
            semesterId,
          },
          orderBy: { label: "asc" },
          select: { label: true, amount: true },
        })
      : [];

    const number = await nextInvoiceNumber();

    await prisma.$transaction(async (tx) => {
      const invoice = await unique(invoiceLabel, () =>
        tx.invoice.create({
          data: {
            number,
            studentId,
            campusId,
            semesterId,
            programId: enrollment?.programId ?? null,
            dueAt,
            note,
            status: InvoiceStatus.OPEN,
          },
          select: { id: true },
        }),
      );

      if (feeItems.length > 0) {
        await tx.invoiceLine.createMany({
          data: feeItems.map((item) => ({
            invoiceId: invoice.id,
            label: item.label,
            amount: Number(String(item.amount)),
          })),
        });
      }
    });
  });
}

export async function addInvoiceLine(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = hiddenId(formData, "invoiceId", invoiceLabel);
    const lineLabel = requiredText(formData, "label", fieldLabel("label"));
    const amount = requiredNumber(formData, "amount", fieldLabel("amount"));
    if (amount < 0) throw new FieldError(fieldErrors.number(fieldLabel("amount")));

    const invoice = await campusInvoice(scope.campusId, invoiceId);

    await prisma.invoiceLine.create({
      data: { invoiceId: invoice.id, label: lineLabel, amount },
    });

    await recompute(invoice.id);
  });
}

export async function recordPayment(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = requiredText(formData, "invoiceId", fieldLabel("invoiceId"));
    const invoice = await campusInvoice(scope.campusId, invoiceId);

    // Only an unsettled bill can take money; the wording names the status that refused it.
    if (invoice.status !== InvoiceStatus.OPEN && invoice.status !== InvoiceStatus.PARTIAL) {
      throw new FieldError(fieldErrors.choice(labels.invoiceStatus[invoice.status]));
    }

    const amount = requiredNumber(formData, "amount", fieldLabel("amount"));
    if (amount <= 0) throw new FieldError(fieldErrors.number(fieldLabel("amount")));

    const method = enumField(formData, "method", METHODS, fieldLabel("method"));
    const reference = text(formData, "reference");
    const paidAt = requiredDate(formData, "paidAt", fieldLabel("paidAt"));

    // The payer is whoever owns the bill, taken from the invoice row rather than the form.
    await prisma.payment.create({
      data: { invoiceId: invoice.id, studentId: invoice.studentId, amount, method, reference, paidAt },
    });

    await recompute(invoice.id);
  });
}

/**
 * One receipt, spread across a student's unpaid periods oldest-due first.
 *
 * The money is not parked in a new account: each period it settles gets a real payment row
 * with the same receipt number, and each invoice's status is recomputed the same way a
 * single-invoice payment is. That keeps the accounts module the single source of truth.
 */
export async function recordStudentPayment(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const studentId = requiredText(formData, "studentId", fieldLabel("studentId"));
    const amount = requiredNumber(formData, "amount", fieldLabel("amount"));
    if (amount <= 0) throw new FieldError(fieldErrors.number(fieldLabel("amount")));

    const method = enumField(formData, "method", METHODS, fieldLabel("method"));
    const reference = text(formData, "reference");
    const paidAt = requiredDate(formData, "paidAt", fieldLabel("paidAt"));

    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true },
    });
    if (!student) throw new FieldError(fieldErrors.notOnCampus);

    const receiptNo = await nextReceiptNumber();

    await prisma.$transaction(async (tx) => {
      const outcome = await allocateStudentPayment(tx, {
        studentId: student.id,
        amount,
        method,
        reference,
        paidAt,
        receiptNo,
      });

      if (!outcome.ok) {
        throw outcome.reason === "overpay"
          ? new FieldError(pages.accounts.payment.student.overpay(money(outcome.outstanding)))
          : new FieldError(pages.accounts.payment.student.nothingOwed);
      }
    });
  });
}

/**
 * Bills a student who was enrolled before their programme's fee structure was published.
 * Reads the same generator enrolment uses, so a backfilled schedule is identical and the
 * unique key still refuses a second run.
 */
export async function generateEnrollmentFees(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const enrollmentId = hiddenId(formData, "enrollmentId", fieldLabel("studentId"));

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      studentId: true,
      programId: true,
      campusId: true,
      enrolledAt: true,
      intake: { select: { commenceAt: true } },
    },
  });
  if (!enrollment || (scope.campusId !== null && enrollment.campusId !== scope.campusId)) {
    throw new FieldError(fieldErrors.notOnCampus);
  }

  const studentPath = `/dashboard/students/${enrollment.studentId}`;

  return onSave(studentPath, [...AFFECTED, studentPath], async () => {
    const plan = await activePlanFor(enrollment.programId);
    if (!plan) throw new FieldError(pages.students.profile.fees.noPlan);

    const numbers = await nextInvoiceNumbers(plan.periods.length);

    await prisma.$transaction(async (tx) => {
      await generateFeeSchedule(tx, {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        campusId: enrollment.campusId,
        programId: enrollment.programId,
        startDate: enrollment.intake?.commenceAt ?? enrollment.enrolledAt,
        numbers,
      });
    });
  });
}

export async function voidInvoice(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = hiddenId(formData, "invoiceId", invoiceLabel);
    const invoice = await campusInvoice(scope.campusId, invoiceId);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.VOID },
    });
  });
}
