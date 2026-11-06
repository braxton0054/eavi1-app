import Link from "next/link";
import type { ReactNode } from "react";

import { getStudent } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
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
    gender: student.gender ? labels.gender[student.gender] : common.notSet,
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

  const invoiceRows: Row[] = student.invoices.map((invoice) => {
    const billed = sum(invoice.lines);
    const paid = sum(invoice.payments);
    return {
      id: invoice.id,
      cells: {
        number: invoice.number,
        issued: formatDate(invoice.createdAt),
        dueAt: formatDate(invoice.dueAt),
        billed: money(billed),
        paid: money(paid),
        balance: money(billed - paid),
        status: (
          <StatusChip tone={invoice.status === "PAID" ? "success" : invoice.status === "VOID" ? "neutral" : "warning"}>
            {labels.invoiceStatus[invoice.status]}
          </StatusChip>
        ),
      },
    };
  });

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

      <Panel title={copy.profile.finance}>
        {invoiceRows.length === 0 ? (
          <EmptyState title={pages.accounts.empty.title} body={pages.accounts.empty.body} icon="accounts" />
        ) : (
          <DataTable
            columns={[
              ...ordered(pages.accounts.invoiceColumns, ["number", "issued", "dueAt"]),
              { key: "billed", label: pages.accounts.summary.billed, align: "end" },
              ...ordered(pages.accounts.invoiceColumns, ["paid", "balance", "status"]),
            ]}
            rows={invoiceRows}
            caption={copy.profile.finance}
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
