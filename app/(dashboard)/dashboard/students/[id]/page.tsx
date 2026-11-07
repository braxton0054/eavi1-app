import Link from "next/link";
import type { ReactNode } from "react";

import { generateEnrollmentFees, recordStudentPayment } from "@/lib/actions/college/accounts";
import { getStudent } from "@/lib/dal/college";
import { genderLabel } from "@/lib/content/apply";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, PageHeader, Panel, StatTile } from "@/components/dashboard/panel";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate, money } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.students;

const enrollmentTone: Record<string, ChipTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  COMPLETED: "info",
  WITHDRAWN: "danger",
};

const cardTone: Record<string, ChipTone> = {
  PENDING: "neutral",
  PRINTING: "info",
  ISSUED: "success",
  LOST: "danger",
  REPLACED: "warning",
};

const feeTone: Record<string, ChipTone> = {
  PENDING: "warning",
  PARTIAL: "info",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "neutral",
};

/** Prisma hands back Decimal objects for money; only Number(String(v)) is safe here. */
const sum = (rows: { amount: unknown }[]) =>
  rows.reduce((total, row) => total + (Number(String(row.amount)) || 0), 0);

/** Picks the columns a profile panel needs, in the order the panel lists them. */
function ordered(columns: readonly Column[], keys: readonly string[]): Column[] {
  return keys.map((key) => ({ key, label: columns.find((column) => column.key === key)?.label ?? key }));
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let student: Awaited<ReturnType<typeof getStudent>> | null = null;
  try {
    student = await getStudent(id);
  } catch (error) {
    // getStudent throws "not_found" for a missing row or another campus's row; everything
    // else, including the sign-in redirect, must keep travelling upwards untouched.
    if (error instanceof Error && error.message === "not_found") student = null;
    else throw error;
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader title={common.notFoundTitle} description={common.notFoundBody} />
        <Panel>
          <EmptyState
            title={common.notFoundTitle}
            body={common.notFoundBody}
            icon="students"
            action={
              <ShimmerButton asChild>
                <Link href="/dashboard/students">{common.back}</Link>
              </ShimmerButton>
            }
          />
        </Panel>
      </div>
    );
  }

  const activeEnrollment = student.enrollments.find((enrollment) => enrollment.status === "ACTIVE");

  // One entry per create-form field name; the descriptor's label doubles as the display label.
  const profileValues: Record<string, ReactNode> = {
    fullName: student.user.fullName,
    email: student.user.email,
    phone: student.user.phone ?? common.notSet,
    programId: activeEnrollment ? `${activeEnrollment.program.name} (${activeEnrollment.program.code})` : common.notSet,
    intakeId: activeEnrollment?.intake?.name ?? common.notSet,
    admissionNo: student.admissionNo,
    password: common.none,
    gender: genderLabel(student.gender) ?? common.notSet,
    dateOfBirth: formatDate(student.dateOfBirth),
    nationalId: student.nationalId ?? common.notSet,
    guardianName: student.guardianName ?? common.notSet,
    guardianPhone: student.guardianPhone ?? common.notSet,
    guardianEmail: student.guardianEmail ?? common.notSet,
    address: student.address ?? common.notSet,
  };

  const enrollmentRows: Row[] = student.enrollments.map((enrollment) => ({
    id: enrollment.id,
    cells: {
      program: `${enrollment.program.name} (${enrollment.program.code})`,
      intake: enrollment.intake?.name ?? common.notSet,
      cohort: enrollment.cohort ?? common.notSet,
      status: (
        <StatusChip tone={enrollmentTone[enrollment.status] ?? "neutral"}>
          {labels.enrollmentStatus[enrollment.status]}
        </StatusChip>
      ),
      enrolledAt: formatDate(enrollment.enrolledAt),
    },
  }));

  const feeCopy = copy.profile.fees;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // A fee period's status is derived, never stored: what is owed comes from the lines, what
  // was paid from the payments, and "overdue" simply means the due date has gone by.
  const feeRows = student.invoices.map((invoice) => {
    const billed = sum(invoice.lines);
    const paid = sum(invoice.payments);
    const balance = billed - paid;
    const overdue =
      invoice.status !== "VOID" &&
      balance > 0.005 &&
      invoice.dueAt !== null &&
      new Date(invoice.dueAt) < today;

    const status: keyof typeof labels.periodStatus =
      invoice.status === "VOID"
        ? "VOID"
        : balance <= 0.005
          ? "PAID"
          : overdue
            ? "OVERDUE"
            : paid > 0.005
              ? "PARTIAL"
              : "PENDING";

    return { invoice, billed, paid, balance, status };
  });

  const payable = feeRows.filter((row) => row.status !== "VOID");
  const billed = payable.reduce((total, row) => total + row.billed, 0);
  const collected = payable.reduce((total, row) => total + row.paid, 0);
  const outstanding = Math.max(0, billed - collected);
  const settled = payable.filter((row) => row.status === "PAID").length;

  const unpaid = payable
    .filter((row) => row.balance > 0.005)
    .sort(
      (a, b) =>
        (a.invoice.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.invoice.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
    );
  const nextDue = unpaid[0] ?? null;
  const overdueRows = unpaid.filter((row) => row.status === "OVERDUE");
  const overdueAmount = overdueRows.reduce((total, row) => total + row.balance, 0);

  const current =
    [...payable]
      .filter((row) => row.invoice.dueAt !== null && new Date(row.invoice.dueAt) <= today)
      .sort(
        (a, b) =>
          (b.invoice.dueAt?.getTime() ?? 0) - (a.invoice.dueAt?.getTime() ?? 0),
      )[0] ?? null;

  const feeTableRows: Row[] = payable.map((row) => ({
    id: row.invoice.id,
    cells: {
      period: row.invoice.feePeriod?.label ?? row.invoice.note ?? row.invoice.number,
      calendar: row.invoice.semester?.name ?? common.notSet,
      dueAt: formatDate(row.invoice.dueAt),
      amount: money(row.billed),
      paid: money(row.paid),
      balance: (
        <span className={row.balance > 0.005 ? "text-eavi-destructive" : undefined}>
          {money(row.balance)}
        </span>
      ),
      status: (
        <StatusChip tone={feeTone[row.status] ?? "neutral"}>
          {labels.periodStatus[row.status]}
        </StatusChip>
      ),
    },
  }));

  const payments = student.invoices
    .flatMap((invoice) =>
      invoice.payments.map((payment) => ({
        payment,
        period: invoice.feePeriod?.label ?? invoice.number,
      })),
    )
    .sort((a, b) => b.payment.paidAt.getTime() - a.payment.paidAt.getTime());

  const paymentRows: Row[] = payments.map(({ payment, period }) => ({
    id: payment.id,
    cells: {
      paidAt: formatDate(payment.paidAt),
      receipt: payment.receiptNo ?? common.notSet,
      period,
      method: labels.paymentMethod[payment.method],
      reference: payment.reference ?? common.notSet,
      amount: money(payment.amount),
    },
  }));

  const cardRows: Row[] = student.idCards.map((card) => ({
    id: card.id,
    cells: {
      serial: card.serial,
      status: (
        <StatusChip tone={cardTone[card.status] ?? "neutral"}>
          {labels.cardStatus[card.status]}
        </StatusChip>
      ),
      issuedAt: formatDate(card.issuedAt),
      expiresAt: formatDate(card.expiresAt),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.user.fullName}
        meta={
          <p className="mt-1 text-sm tabular-nums text-eavi-muted-text">{student.admissionNo}</p>
        }
        action={
          <Link
            href="/dashboard/students"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            {common.back}
          </Link>
        }
      />

      <Panel title={copy.profile.personal}>
        <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          {copy.create.fields.map((field) => (
            <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
              <dt className="text-xs text-eavi-muted-text">{field.label}</dt>
              <dd className="min-w-0 text-sm break-words">{profileValues[field.name] ?? common.notSet}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title={copy.profile.enrollments}>
        {enrollmentRows.length === 0 ? (
          <EmptyState title={pages.enrollments.empty.title} body={pages.enrollments.empty.body} icon="enrollments" />
        ) : (
          <DataTable
            columns={ordered(pages.enrollments.columns, ["program", "intake", "cohort", "status", "enrolledAt"])}
            rows={enrollmentRows}
            caption={copy.profile.enrollments}
          />
        )}
      </Panel>

      <section aria-label={feeCopy.overview} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={feeCopy.totalFees} value={money(billed)} icon="accounts" tone="neutral" />
        <StatTile label={feeCopy.paid} value={money(collected)} icon="accounts" tone="money" />
        <StatTile
          label={feeCopy.outstanding}
          value={money(outstanding)}
          icon="accounts"
          tone="attention"
        />
        <StatTile
          label={feeCopy.nextDue}
          value={nextDue ? money(nextDue.balance) : feeCopy.settled}
          icon="calendar"
          tone="neutral"
        />
      </section>

      <Panel
        title={feeCopy.obligations}
        description={`${feeCopy.progress(settled, payable.length)} · ${feeCopy.currentPeriod}: ${
          current?.invoice.feePeriod?.label ?? feeCopy.notStarted
        }`}
      >
        {feeTableRows.length === 0 ? (
          <div className="space-y-4 p-4">
            <p className="text-sm text-eavi-muted-text">{feeCopy.empty}</p>
            {activeEnrollment ? (
              <RowForm
                id={`generate-fees-${activeEnrollment.id}`}
                button={feeCopy.generate}
                fields={[]}
                hidden={{ enrollmentId: activeEnrollment.id }}
                action={generateEnrollmentFees}
                submitLabel={feeCopy.generate}
              />
            ) : (
              <p className="text-sm text-eavi-muted-text">{feeCopy.noEnrollment}</p>
            )}
          </div>
        ) : (
          <>
            <DataTable
              columns={feeCopy.columns as Column[]}
              rows={feeTableRows}
              caption={feeCopy.obligations}
            />
            <div className="flex flex-wrap items-center gap-4 border-t border-eavi-border p-4">
              <DisclosureForm
                id={`student-payment-${student.id}`}
                button={pages.accounts.payment.student.button}
                title={pages.accounts.payment.student.title}
                fields={pages.accounts.payment.student.fields.filter(
                  (field) => field.name !== "studentId",
                )}
                hidden={{ studentId: student.id }}
                action={recordStudentPayment}
                submitLabel={common.record}
              />
              {overdueRows.length > 0 ? (
                <p className="text-sm text-eavi-destructive">
                  {feeCopy.overdue}: {money(overdueAmount)}
                </p>
              ) : null}
            </div>
          </>
        )}
      </Panel>

      <Panel title={feeCopy.history}>
        {paymentRows.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text">{feeCopy.historyEmpty}</p>
        ) : (
          <DataTable
            columns={feeCopy.historyColumns as Column[]}
            rows={paymentRows}
            caption={feeCopy.history}
          />
        )}
      </Panel>

      <Panel title={copy.profile.cards}>
        {cardRows.length === 0 ? (
          <EmptyState title={pages.cards.empty.title} body={pages.cards.empty.body} icon="cards" />
        ) : (
          <DataTable
            columns={ordered(pages.cards.columns, ["serial", "status", "issuedAt", "expiresAt"])}
            rows={cardRows}
            caption={copy.profile.cards}
          />
        )}
      </Panel>
    </div>
  );
}
