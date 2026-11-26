"use server";

import { randomUUID } from "node:crypto";

import { InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { touchInvoice, touchReceipt } from "@/lib/documents/service";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import { moneyExact } from "@/lib/format";
import {
  FieldError,
  dateField,
  enumField,
  hiddenId,
  nextInvoiceNumber,
  nextInvoiceNumbers,
  onSave,
  refresh,
  requiredDate,
  requiredText,
  text,
  periodFromForm,
  unique,
} from "@/lib/actions/college/_shared";
import { activePlanFor, generateFeeSchedule } from "@/lib/fees/schedule";
import { recomputeInvoice } from "@/lib/fees/ledger";
import { parsePaymentAmount, fromCents } from "@/lib/fees/money";
import { FinanceError, recordReceipt } from "@/lib/fees/receipts";
import { correctReceipt, creditInvoice, unvoidInvoice, voidInvoiceWithReason } from "@/lib/fees/corrections";
import { recordAudit } from "@/lib/academics/audit";
import { notifyUser } from "@/lib/notifications/service";

const METHODS = Object.keys(PaymentMethod) as (keyof typeof PaymentMethod)[];

const fieldLabel = (name: string) =>
  pages.accounts.create.fields.find((field) => field.name === name)?.label ??
  pages.accounts.create.lineFields.find((field) => field.name === name)?.label ??
  pages.accounts.payment.fields.find((field) => field.name === name)?.label ??
  name;

const invoiceLabel =
  pages.accounts.invoiceColumns.find((column) => column.key === "number")?.label ?? "number";

const AFFECTED = ["/dashboard/accounts", "/dashboard", "/dashboard/students"];

function amountFromForm(formData: FormData): number {
  const raw = requiredText(formData, "amount", fieldLabel("amount"));
  try {
    return parsePaymentAmount(raw);
  } catch {
    throw new FieldError("Enter a valid amount with no more than two decimal places.");
  }
}

function idempotencyKey(formData: FormData): string {
  return text(formData, "idempotencyKey") ?? randomUUID();
}

async function bestEffort(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    console.error("[accounts] post-commit work failed:", error);
  }
}

/** One receipt, one student, one campus; every affected saved document is marked stale. */
async function touchReceiptDocuments(receiptNo: string) {
  const normalized = receiptNo.toUpperCase();
  const receipt = await prisma.receipt.findUnique({
    where: { numberNormalized: normalized },
    select: { payments: { select: { invoiceId: true } }, sourceInvoiceId: true },
  });
  const invoiceIds = receipt
    ? [...new Set([...receipt.payments.map((row) => row.invoiceId), ...(receipt.sourceInvoiceId ? [receipt.sourceInvoiceId] : [])])]
    : (
        await prisma.payment.findMany({
          where: { receiptNo: { equals: receiptNo, mode: "insensitive" } },
          select: { invoiceId: true },
        })
      ).map((row) => row.invoiceId);
  await Promise.all([
    ...[...new Set(invoiceIds)].map((id) => touchInvoice(id)),
    touchReceipt(receiptNo),
  ]);
}

async function notifyReceipt(studentId: string, receiptNo: string, amount: number) {
  const owner = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { userId: true },
  });
  if (!owner) return;
  await notifyUser(owner.userId, {
    title: "Fee payment received",
    body: `${moneyExact(amount)} received — receipt ${receiptNo}.`,
    notificationType: "fee",
    targetUrl: "/student/fees",
    dedupeKey: `fee:receipt:${receiptNo}`,
  });
}

async function campusInvoice(campusId: number | null, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...(campusId === null ? {} : { campusId }) },
    select: { id: true, status: true, studentId: true, campusId: true },
  });
  if (!invoice) throw new FieldError(fieldErrors.notOnCampus);
  return invoice;
}

export async function createInvoice(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const studentId = requiredText(formData, "studentId", fieldLabel("studentId"));
    const periodId = await periodFromForm(formData, "periodId");
    const dueAt = dateField(formData, "dueAt");
    const note = text(formData, "note");

    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, campusId },
      select: { id: true },
    });
    if (!student) throw new FieldError(fieldErrors.notOnCampus);

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, campusId, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: { programId: true },
    });
    const feeItems = enrollment
      ? await prisma.feeItem.findMany({
          where: { programId: enrollment.programId, isOptional: false, periodId },
          orderBy: { label: "asc" },
          select: { label: true, amount: true },
        })
      : [];

    const number = await nextInvoiceNumber();
    const invoiceId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${studentId}, 0))`;
      const invoice = await unique(invoiceLabel, () =>
        tx.invoice.create({
          data: {
            number,
            studentId,
            campusId,
            periodId,
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
            amount: String(item.amount),
          })),
        });
      }
      await recordAudit({
        campusId,
        actorId: scope.userId,
        actorEmail: scope.email,
        action: "invoice.create",
        entityType: "invoice",
        entityId: invoice.id,
        detail: { number, studentId },
      }, tx);
      return invoice.id;
    });
    await bestEffort(() => touchInvoice(invoiceId));
  });
}

export async function addInvoiceLine(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = hiddenId(formData, "invoiceId", invoiceLabel);
    const lineLabel = requiredText(formData, "label", fieldLabel("label"));
    const amountCents = amountFromForm(formData);
    const invoice = await campusInvoice(scope.campusId, invoiceId);
    if (invoice.status === InvoiceStatus.VOID) throw new FieldError("A void invoice cannot take new charges.");

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${invoice.studentId}, 0))`;
      const locked = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: { status: true } });
      if (locked.status === InvoiceStatus.VOID) throw new FieldError("A void invoice cannot take new charges.");
      await tx.invoiceLine.create({
        data: { invoiceId: invoice.id, label: lineLabel, amount: fromCents(amountCents), createdById: scope.userId, createdByEmail: scope.email },
      });
      await recomputeInvoice(tx, invoice.id);
      await recordAudit({
        campusId: invoice.campusId,
        actorId: scope.userId,
        actorEmail: scope.email,
        action: "invoice.line_add",
        entityType: "invoice",
        entityId: invoice.id,
        detail: { label: lineLabel, amountCents },
      }, tx);
    });
    await bestEffort(() => touchInvoice(invoice.id));
  });
}

export async function recordPayment(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = requiredText(formData, "invoiceId", fieldLabel("invoiceId"));
    const invoice = await campusInvoice(scope.campusId, invoiceId);
    const amountCents = amountFromForm(formData);
    const method = enumField(formData, "method", METHODS, fieldLabel("method"));
    const reference = text(formData, "reference");
    const paidAt = requiredDate(formData, "paidAt", fieldLabel("paidAt"));

    const result = await prisma.$transaction((tx) =>
      recordReceipt(tx, {
        studentId: invoice.studentId,
        campusId: invoice.campusId,
        amountCents,
        method,
        reference,
        paidAt,
        actor: { id: scope.userId, email: scope.email },
        idempotencyKey: idempotencyKey(formData),
        allocation: "SINGLE",
        invoiceId: invoice.id,
      }),
    );
    await bestEffort(() => touchReceiptDocuments(result.receiptNo));
    await bestEffort(() => notifyReceipt(invoice.studentId, result.receiptNo, result.amountCents / 100));
  });
}

export async function recordStudentPayment(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const studentId = requiredText(formData, "studentId", fieldLabel("studentId"));
    const amountCents = amountFromForm(formData);
    const method = enumField(formData, "method", METHODS, fieldLabel("method"));
    const reference = text(formData, "reference");
    const paidAt = requiredDate(formData, "paidAt", fieldLabel("paidAt"));
    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, campusId: true },
    });
    if (!student) throw new FieldError(fieldErrors.notOnCampus);

    const result = await prisma.$transaction((tx) =>
      recordReceipt(tx, {
        studentId: student.id,
        campusId: student.campusId,
        amountCents,
        method,
        reference,
        paidAt,
        actor: { id: scope.userId, email: scope.email },
        idempotencyKey: idempotencyKey(formData),
        allocation: "STUDENT",
      }),
    );
    await bestEffort(() => touchReceiptDocuments(result.receiptNo));
    await bestEffort(() => notifyReceipt(student.id, result.receiptNo, result.amountCents / 100));
  });
}

/** The wizard and every other payment screen use the same receipt service and allocation policy. */
export async function recordWizardPayment(formData: FormData) {
  const scope = await requireCollegeAdmin();

  try {
    const studentId = requiredText(formData, "studentId", fieldLabel("studentId"));
    const invoiceId = requiredText(formData, "invoiceId", fieldLabel("invoiceId"));
    const amountCents = amountFromForm(formData);
    const method = enumField(formData, "method", METHODS, fieldLabel("method"));
    const reference = text(formData, "reference");
    const paidAt = requiredDate(formData, "paidAt", fieldLabel("paidAt"));
    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, campusId: true },
    });
    if (!student) throw new FieldError(fieldErrors.notOnCampus);

    const result = await prisma.$transaction((tx) =>
      recordReceipt(tx, {
        studentId: student.id,
        campusId: student.campusId,
        amountCents,
        method,
        reference,
        paidAt,
        actor: { id: scope.userId, email: scope.email },
        idempotencyKey: idempotencyKey(formData),
        allocation: "STUDENT",
        invoiceId,
        expectedAllocationFingerprint: text(formData, "expectedAllocationFingerprint") ?? undefined,
      }),
    );

    await bestEffort(() => touchReceiptDocuments(result.receiptNo));
    await bestEffort(() => notifyReceipt(student.id, result.receiptNo, result.amountCents / 100));
    await bestEffort(async () => {
      for (const path of AFFECTED) refresh(path);
    });
    return { ok: true as const, receiptNo: result.receiptNo, applied: result.allocations };
  } catch (error) {
    if (error instanceof FieldError || error instanceof FinanceError) {
      return { ok: false as const, error: error.message };
    }
    throw error;
  }
}

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
      period: { select: { startsAt: true } },
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
        startDate: enrollment.period?.startsAt ?? enrollment.enrolledAt,
        numbers,
      });
    });
    const invoices = await prisma.invoice.findMany({ where: { enrollmentId: enrollment.id }, select: { id: true } });
    await bestEffort(() => Promise.all(invoices.map((invoice) => touchInvoice(invoice.id))));
  });
}

export async function voidInvoice(formData: FormData) {
  const scope = await requireCollegeAdmin();
  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = hiddenId(formData, "invoiceId", invoiceLabel);
    const reason = requiredText(formData, "reason", "Reason");
    const invoice = await campusInvoice(scope.campusId, invoiceId);
    try {
      await prisma.$transaction((tx) =>
        voidInvoiceWithReason(tx, {
          invoiceId: invoice.id,
          reason,
          actor: { id: scope.userId, email: scope.email },
        }),
      );
    } catch (error) {
      if (error instanceof FinanceError) throw new FieldError(error.message);
      throw error;
    }
    await bestEffort(() => touchInvoice(invoice.id));
  });
}

export async function restoreInvoice(formData: FormData) {
  const scope = await requireCollegeAdmin();
  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = hiddenId(formData, "invoiceId", invoiceLabel);
    const reason = requiredText(formData, "reason", "Reason");
    const invoice = await campusInvoice(scope.campusId, invoiceId);
    try {
      await prisma.$transaction((tx) =>
        unvoidInvoice(tx, {
          invoiceId: invoice.id,
          reason,
          actor: { id: scope.userId, email: scope.email },
        }),
      );
    } catch (error) {
      if (error instanceof FinanceError) throw new FieldError(error.message);
      throw error;
    }
    await bestEffort(() => touchInvoice(invoice.id));
  });
}

export async function correctPayment(formData: FormData) {
  const scope = await requireCollegeAdmin();
  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const paymentId = hiddenId(formData, "paymentId", "Payment");
    const kind = enumField(formData, "kind", ["REVERSAL", "REFUND"] as const, "Correction type");
    const reason = requiredText(formData, "reason", "Reason");
    const effectiveAt = requiredDate(formData, "effectiveAt", "Effective date");
    const reference = text(formData, "reference");
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, ...(scope.campusId === null ? {} : { invoice: { campusId: scope.campusId } }) },
      select: { receiptId: true },
    });
    if (!payment) throw new FieldError(fieldErrors.notOnCampus);

    let creditNoteNo = "";
    try {
      const result = await prisma.$transaction((tx) =>
        correctReceipt(tx, {
          receiptId: payment.receiptId,
          kind,
          reason,
          effectiveAt,
          reference,
          actor: { id: scope.userId, email: scope.email },
          idempotencyKey: idempotencyKey(formData),
        }),
      );
      creditNoteNo = result.creditNoteNo;
    } catch (error) {
      if (error instanceof FinanceError) throw new FieldError(error.message);
      throw error;
    }
    await bestEffort(() => touchReceiptDocuments(creditNoteNo));
  });
}

export async function issueCreditNote(formData: FormData) {
  const scope = await requireCollegeAdmin();
  return onSave("/dashboard/accounts", AFFECTED, async () => {
    const invoiceId = hiddenId(formData, "invoiceId", invoiceLabel);
    const amountCents = amountFromForm(formData);
    const reason = requiredText(formData, "reason", "Reason");
    const effectiveAt = requiredDate(formData, "effectiveAt", "Effective date");
    const invoice = await campusInvoice(scope.campusId, invoiceId);
    let creditNoteNo = "";
    try {
      const result = await prisma.$transaction((tx) =>
        creditInvoice(tx, {
          invoiceId: invoice.id,
          amountCents,
          reason,
          effectiveAt,
          actor: { id: scope.userId, email: scope.email },
          idempotencyKey: idempotencyKey(formData),
        }),
      );
      creditNoteNo = result.creditNoteNo;
    } catch (error) {
      if (error instanceof FinanceError) throw new FieldError(error.message);
      throw error;
    }
    await bestEffort(() => touchReceiptDocuments(creditNoteNo));
  });
}
