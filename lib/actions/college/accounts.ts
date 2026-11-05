"use server";

import { InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, labels, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  dateField,
  enumField,
  hiddenId,
  nextInvoiceNumber,
  onSave,
  requiredDate,
  requiredNumber,
  requiredText,
  text,
  semesterOnCampus,
  unique,
} from "@/lib/actions/college/_shared";

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

/** Prisma hands back Decimal objects; only Number(String(v)) is safe for money. */
const sumAmounts = (rows: { amount: unknown }[]) =>
  rows.reduce((total, row) => total + (Number(String(row.amount)) || 0), 0);

/**
 * The invoice status is always derived from its own rows, never typed in: lines decide what
 * is owed, payments decide how far it has got. A void invoice is left exactly as it is.
 */
async function recompute(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, lines: { select: { amount: true } }, payments: { select: { amount: true } } },
  });
  if (!invoice || invoice.status === InvoiceStatus.VOID) return;

  const billed = sumAmounts(invoice.lines);
  const paid = sumAmounts(invoice.payments);

  const status =
    invoice.lines.length > 0 && billed - paid <= 0
      ? InvoiceStatus.PAID
      : paid > 0 && paid < billed
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.OPEN;

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
}

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
