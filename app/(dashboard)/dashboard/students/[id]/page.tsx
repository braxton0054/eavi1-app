import Link from "next/link";

import { registerUnitPeriod, saveUnitResult } from "@/lib/actions/college/program-units";
import { recordStudentAttachment } from "@/lib/actions/college/attachments";
import { getStudent } from "@/lib/dal/college";
import { genderLabel } from "@/lib/content/apply";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { updateStudentPhoto } from "@/lib/actions/college/students";
import { PrintButton } from "@/components/dashboard/print-button";
import { StudentPrintDocument, type PrintFact } from "@/components/dashboard/student-print-document";
import { EmptyState, PageHeader, Panel, StatTile } from "@/components/dashboard/panel";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate, moneyExact } from "@/lib/format";
import type { Column, Field } from "@/lib/content/dashboard";
import { invoicePosition } from "@/lib/fees/ledger";

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
  CREDIT: "info",
  OVERDUE: "danger",
  VOID: "neutral",
};

type FeeStatus = "PENDING" | "PARTIAL" | "PAID" | "CREDIT" | "OVERDUE" | "VOID";

const unitTone: Record<string, ChipTone> = {
  NOT_STARTED: "neutral",
  REGISTERED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  DEFERRED: "neutral",
};

const attachmentTone: Record<string, ChipTone> = {
  NOT_ELIGIBLE: "neutral",
  ELIGIBLE: "info",
  ATTACHED: "warning",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  DEFERRED: "neutral",
};

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

  /*
   * Details grouped by meaning, with empty values left out.
   *
   * The old page printed every field in one list, so five "Not recorded" lines took as much
   * room as the name and the programme. A reader looking for a guardian's phone number now
   * finds it under Guardian, and a missing value is stated once per group instead of
   * repeated down the page.
   */
  const field = (name: string) =>
    copy.create.fields.find((f) => f.name === name)?.label ?? name;

  const known = (value: string | null | undefined) =>
    value && value !== common.notSet ? value : null;

  const detailGroups = [
    {
      title: copy.profile.groups.contact,
      empty: copy.profile.missingHint,
      rows: [
        { label: field("email"), value: known(student.user.email) },
        { label: field("phone"), value: known(student.user.phone) },
        { label: field("address"), value: known(student.address) },
      ].filter((row): row is { label: string; value: string } => row.value !== null),
    },
    {
      title: copy.profile.groups.personal,
      empty: copy.profile.missingHint,
      rows: [
        { label: field("gender"), value: known(genderLabel(student.gender)) },
        { label: field("dateOfBirth"), value: known(formatDate(student.dateOfBirth)) },
        { label: field("nationalId"), value: known(student.nationalId) },
        { label: field("previousInstitution"), value: known(student.previousInstitution) },
      ].filter((row): row is { label: string; value: string } => row.value !== null),
    },
    {
      title: copy.profile.groups.guardian,
      empty: copy.profile.missingHint,
      rows: [
        { label: field("guardianName"), value: known(student.guardianName) },
        { label: field("guardianPhone"), value: known(student.guardianPhone) },
        { label: field("guardianEmail"), value: known(student.guardianEmail) },
      ].filter((row): row is { label: string; value: string } => row.value !== null),
    },
  ];

  const enrollmentRows: Row[] = student.enrollments.map((enrollment) => ({
    id: enrollment.id,
    cells: {
      program: `${enrollment.program.name} (${enrollment.program.code})`,
      intake: enrollment.period?.name ?? common.notSet,
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
  const printCopy = copy.profile.print;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // A fee period's status is derived from exact minor units, never from its stored status alone.
  const feeRows = student.invoices.map((invoice) => {
    const position = invoicePosition(invoice.lines, invoice.payments);
    const overdue =
      invoice.status !== "VOID" &&
      position.outstandingCents > 0 &&
      invoice.dueAt !== null &&
      new Date(invoice.dueAt) < today;

    const status: FeeStatus =
      invoice.status === "VOID"
        ? "VOID"
        : position.balanceCents < 0
          ? "CREDIT"
          : position.outstandingCents === 0 && invoice.lines.length > 0
            ? "PAID"
            : overdue
              ? "OVERDUE"
              : position.paidCents > 0 && position.paidCents < position.billedCents
                ? "PARTIAL"
                : "PENDING";

    return {
      invoice,
      ...position,
      billed: position.billedCents / 100,
      paid: position.paidCents / 100,
      balance: position.balanceCents / 100,
      outstanding: position.outstandingCents / 100,
      credit: position.creditCents / 100,
      status,
    };
  });

  /*
   * A record shows the student as they stand: the period they are in and the ones behind
   * them, never periods they have not reached.
   *
   * The progression history of a student can leave bills for periods ahead of them — an
   * older enrolment that billed the whole programme up front, or a stage that was corrected
   * downwards. Printing those says the student owes for a semester they have not started, so
   * anything past their current position is left off the record and out of its totals.
   */
  const reachedYear = activeEnrollment?.yearIndex ?? null;
  const reachedSemester = activeEnrollment?.semesterNo ?? null;

  const isReached = (yearIndex: number | null, semesterNo: number | null) => {
    if (reachedYear === null || reachedSemester === null) return true;
    if (yearIndex === null || semesterNo === null) return true;
    return yearIndex * 100 + semesterNo <= reachedYear * 100 + reachedSemester;
  };

  const payable = feeRows.filter(
    (row) =>
      row.status !== "VOID" &&
      isReached(row.invoice.feePeriod?.yearIndex ?? null, row.invoice.feePeriod?.semesterNo ?? null),
  );
  const billedCents = payable.reduce((total, row) => total + row.billedCents, 0);
  const collectedCents = payable.reduce((total, row) => total + row.paidCents, 0);
  const outstandingCents = payable.reduce((total, row) => total + row.outstandingCents, 0);
  const creditCents = payable.reduce((total, row) => total + row.creditCents, 0);
  const billed = billedCents / 100;
  const collected = collectedCents / 100;
  const outstanding = outstandingCents / 100;
  const credit = creditCents / 100;
  const settled = payable.filter((row) => row.status === "PAID").length;

  const unpaid = payable
    .filter((row) => row.outstandingCents > 0)
    .sort(
      (a, b) =>
        (a.invoice.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.invoice.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
    );
  const nextDue = unpaid[0] ?? null;
  const overdueRows = unpaid.filter((row) => row.status === "OVERDUE");
  const overdueCents = overdueRows.reduce((total, row) => total + row.outstandingCents, 0);
  const overdueAmount = overdueCents / 100;

  const current =
    [...payable]
      .filter((row) => row.invoice.dueAt !== null && new Date(row.invoice.dueAt) <= today)
      .sort(
        (a, b) =>
          (b.invoice.dueAt?.getTime() ?? 0) - (a.invoice.dueAt?.getTime() ?? 0),
      )[0] ?? null;

  /*
   * A bill's period comes from the plan row it was raised against. The invoice number is a
   * document reference, not a period, so it is never used as the fallback — an invoice with
   * no period (a manually raised charge) says so and shows its number in its own column.
   */
  type StudentInvoice = (typeof student.invoices)[number];
  const periodLabel = (invoice: StudentInvoice) =>
    invoice.feePeriod?.label ?? invoice.note ?? copy.profile.print.noPeriod;

  const feeTableRows: Row[] = payable.map((row) => ({
    id: row.invoice.id,
    cells: {
      period: periodLabel(row.invoice),
      calendar: row.invoice.period?.name ?? common.notSet,
      dueAt: formatDate(row.invoice.dueAt),
      amount: moneyExact(row.billed),
      paid: moneyExact(row.paid),
      balance: (
        <span className={row.outstandingCents > 0 ? "text-eavi-destructive" : undefined}>
          {moneyExact(row.balance)}
        </span>
      ),
      status: (
        <StatusChip tone={feeTone[row.status] ?? "neutral"}>
          {labels.periodStatus[row.status as keyof typeof labels.periodStatus] ?? row.status}
        </StatusChip>
      ),
    },
  }));

  // Money received is counted against the bills the record shows, so a receipt for a period
  // ahead of the student never appears as history for a semester they have not reached.
  const shownInvoiceIds = new Set(payable.map((row) => row.invoice.id));
  const payments = student.invoices
    .filter((invoice) => shownInvoiceIds.has(invoice.id))
    .flatMap((invoice) =>
      invoice.payments.map((payment) => ({
        payment,
        period: periodLabel(invoice),
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
      amount: moneyExact(payment.amount),
    },
  }));

  /* ------------------------------------------------------------ academic progress */

  const academicCopy = copy.profile.academic;
  const attachmentCopy = pages.programs.attachments;

  const units = activeEnrollment?.units ?? [];
  const attachments = activeEnrollment?.attachments ?? [];
  const completedUnits = units.filter((unit) => unit.status === "COMPLETED").length;

  // Periods are read off the student's own placed units, so the same control works for a
  // semester programme, a monthly one and a module-based one.
  const periodOptions = [
    ...new Map(
      units.map((unit) => [unit.programUnit.periodKey, unit.programUnit.periodLabel]),
    ).entries(),
  ].map(([value, label]) => ({ value, label }));

  const currentUnit =
    [...units].reverse().find((unit) => unit.status === "IN_PROGRESS" || unit.status === "REGISTERED") ??
    units.find((unit) => unit.status === "NOT_STARTED") ??
    null;

  const registerFields: Field[] = [
    { name: "periodKey", label: academicCopy.period, type: "select", required: true, options: periodOptions },
    { name: "override", label: academicCopy.override, type: "checkbox" },
  ];

  const unitRows: Row[] = units.map((unit) => ({
    id: unit.id,
    cells: {
      unit: `${unit.programUnit.unit.code} · ${unit.programUnit.unit.name}`,
      period: unit.programUnit.periodLabel,
      status: (
        <StatusChip tone={unitTone[unit.status] ?? "neutral"}>
          {labels.unitStatus[unit.status]}
        </StatusChip>
      ),
      result: unit.score !== null
        ? `${Number(String(unit.score))}${unit.maxScore !== null ? `/${Number(String(unit.maxScore))}` : ""}${unit.grade ? ` · ${unit.grade}` : ""}`
        : unit.grade ?? common.notSet,
      actions: (
        <RowForm
          id={`unit-result-${unit.id}`}
          button={academicCopy.resultTitle}
          fields={academicCopy.resultFields}
          values={{
            status: unit.status,
            score: unit.score !== null ? String(Number(String(unit.score))) : undefined,
            maxScore: unit.maxScore !== null ? String(Number(String(unit.maxScore))) : undefined,
            grade: unit.grade ?? undefined,
            remark: unit.remark ?? undefined,
          }}
          hidden={{ studentUnitId: unit.id }}
          action={saveUnitResult}
          submitLabel={common.save}
          wide
        />
      ),
    },
  }));

  const attachmentRows: Row[] = attachments.map((attachment) => ({
    id: attachment.id,
    cells: {
      stage: attachment.requirement.label,
      status: (
        <StatusChip tone={attachmentTone[attachment.status] ?? "neutral"}>
          {labels.attachmentStatus[attachment.status]}
        </StatusChip>
      ),
      host: attachment.hostOrganization ?? common.notSet,
      dates: [
        attachment.startDate ? `From ${formatDate(attachment.startDate)}` : null,
        attachment.expectedEndDate ? `to ${formatDate(attachment.expectedEndDate)}` : null,
      ]
        .filter(Boolean)
        .join(" ") || common.notSet,
      supervisor: attachment.supervisorName ?? common.notSet,
      result: [attachment.grade, attachment.completedAt ? formatDate(attachment.completedAt) : null]
        .filter(Boolean)
        .join(" · ") || common.notSet,
      actions: (
        <RowForm
          id={`attachment-${attachment.id}`}
          button={attachmentCopy.record}
          fields={attachmentCopy.fields}
          values={{
            status: attachment.status,
            hostOrganization: attachment.hostOrganization ?? undefined,
            supervisorName: attachment.supervisorName ?? undefined,
            supervisorPhone: attachment.supervisorPhone ?? undefined,
            supervisorEmail: attachment.supervisorEmail ?? undefined,
            grade: attachment.grade ?? undefined,
            assessmentNote: attachment.assessmentNote ?? undefined,
            remark: attachment.remark ?? undefined,
          }}
          hidden={{ attachmentId: attachment.id }}
          action={recordStudentAttachment}
          submitLabel={common.save}
          wide
        />
      ),
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

  /* ------------------------------------------------------------------ print model */

  /*
   * The sheet is built from the same numbers the screen shows, so the two can never
   * disagree. Dates arrive already formatted as `DD Mon YYYY` and money as KES, because the
   * print document only lays out what it is given.
   */
  const asFacts = (rows: { label: string; value: string }[]): PrintFact[] =>
    rows.map((row) => ({ label: row.label, value: row.value }));

  /** One printed cell; a gap prints as a dash rather than as nothing. */
  const cell = (value: string | null | undefined): string =>
    value && value.trim().length > 0 ? value : "—";

  const printStudent = {
    fullName: student.user.fullName,
    admissionNo: student.admissionNo,
    status: activeEnrollment
      ? (labels.enrollmentStatus[activeEnrollment.status] ?? copy.profile.notEnrolled)
      : copy.profile.notEnrolled,
    programme: activeEnrollment
      ? `${activeEnrollment.program.name} (${activeEnrollment.program.code})`
      : common.notSet,
    enrolled: activeEnrollment
      ? [formatDate(activeEnrollment.enrolledAt), activeEnrollment.period?.name]
          .filter(Boolean)
          .join(" · ")
      : common.notSet,
    photoUrl: student.profilePhotoUrl,
    contact: asFacts(detailGroups[0].rows),
    personal: asFacts(detailGroups[1].rows),
    guardian: asFacts(detailGroups[2].rows),
    enrollments: student.enrollments.map((enrollment) => [
      cell(`${enrollment.program.name} (${enrollment.program.code})`),
      cell(enrollment.period?.name),
      cell(enrollment.cohort),
      cell(labels.enrollmentStatus[enrollment.status]),
      cell(formatDate(enrollment.enrolledAt)),
    ]),
    totals: {
      billed: moneyExact(billed),
      paid: moneyExact(collected),
      outstanding: moneyExact(outstanding),
      nextDue: nextDue ? moneyExact(nextDue.outstanding) : feeCopy.settled,
    },
    settledLine: printCopy.settledLine(
      settled,
      payable.length,
      current?.invoice.feePeriod?.label ?? feeCopy.notStarted,
    ),
    // Oldest first: a schedule is read forwards, like a calendar.
    invoices: [...payable]
      .sort(
        (a, b) =>
          (a.invoice.dueAt?.getTime() ?? 0) - (b.invoice.dueAt?.getTime() ?? 0),
      )
      .map((row) => ({
        id: row.invoice.id,
        period: periodLabel(row.invoice),
        invoice: row.invoice.number,
        due: formatDate(row.invoice.dueAt),
        amount: moneyExact(row.billed),
        paid: moneyExact(row.paid),
        balance: moneyExact(row.balance),
        status: labels.periodStatus[row.status as keyof typeof labels.periodStatus] ?? row.status,
        owed: row.outstandingCents > 0,
      })),
    overdueTotal: overdueRows.length > 0 ? moneyExact(overdueAmount) : null,
    // Oldest first here too, so receipts read in the order they were written.
    payments: [...payments]
      .sort((a, b) => a.payment.paidAt.getTime() - b.payment.paidAt.getTime())
      .map(({ payment, period }) => ({
        id: payment.id,
        date: formatDate(payment.paidAt),
        receipt: payment.receiptNo ?? common.notSet,
        appliedTo: period,
        method: labels.paymentMethod[payment.method],
        reference: payment.reference ?? common.notSet,
        amount: moneyExact(payment.amount),
      })),
    units: units.map((unit) => [
      cell(`${unit.programUnit.unit.code} · ${unit.programUnit.unit.name}`),
      cell(unit.programUnit.periodLabel),
      cell(labels.unitStatus[unit.status]),
      cell(
        unit.score !== null
          ? `${Number(String(unit.score))}${unit.maxScore !== null ? `/${Number(String(unit.maxScore))}` : ""}${unit.grade ? ` · ${unit.grade}` : ""}`
          : (unit.grade ?? common.notSet),
      ),
    ]),
    attachments: attachments.map((attachment) => [
      cell(attachment.requirement.label),
      cell(labels.attachmentStatus[attachment.status]),
      cell(attachment.hostOrganization),
      cell(
        [
          attachment.startDate ? `From ${formatDate(attachment.startDate)}` : null,
          attachment.expectedEndDate ? `to ${formatDate(attachment.expectedEndDate)}` : null,
        ]
          .filter(Boolean)
          .join(" "),
      ),
      cell(
        [attachment.grade, attachment.completedAt ? formatDate(attachment.completedAt) : null]
          .filter(Boolean)
          .join(" · "),
      ),
    ]),
    cards: student.idCards.map((card) => [
      cell(card.serial),
      cell(labels.cardStatus[card.status]),
      cell(formatDate(card.issuedAt)),
      cell(formatDate(card.expiresAt)),
    ]),
  };

  return (
    <>
      <div className="space-y-6" data-print="record">
      {/* The paper version of this record is its own document, rendered below this block
          and hidden on screen. Nothing here needs a print variant of its own. */}
      <div data-print="screen-only">
        <PageHeader
          title={student.user.fullName}
          meta={
            <p className="mt-1 text-sm tabular-nums text-eavi-muted-text">{student.admissionNo}</p>
          }
          action={
            <div className="flex items-center gap-2">
              <PrintButton pdfHref={`/api/students/${student.id}/details`} />
              <Link
                href="/dashboard/students"
                className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
              >
                {common.back}
              </Link>
            </div>
          }
        />
      </div>

      {/* A student's page opens with who they are, not with a list of fields. The photograph
          and the three facts a reader asks for first — programme, intake, when they joined —
          sit together, so the page answers "who is this?" before it answers anything else. */}
      <Panel>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5">
          {student.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={student.profilePhotoUrl}
              alt={copy.profile.photoAlt(student.user.fullName)}
              className="h-36 w-27 shrink-0 self-start rounded-xl border border-eavi-border bg-eavi-primary-soft object-contain sm:h-40 sm:w-30"
            />
          ) : (
            <div className="flex h-36 w-27 shrink-0 items-center justify-center self-start rounded-xl border border-dashed border-eavi-border bg-eavi-primary-soft px-2 text-center text-[11px] leading-tight text-eavi-muted-text sm:h-40 sm:w-30">
              {copy.profile.noPhoto}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm tabular-nums text-eavi-muted-text">{student.admissionNo}</p>
                {activeEnrollment ? (
                  <StatusChip tone={enrollmentTone[activeEnrollment.status] ?? "neutral"}>
                    {labels.enrollmentStatus[activeEnrollment.status]}
                  </StatusChip>
                ) : (
                  <StatusChip tone="neutral">{copy.profile.notEnrolled}</StatusChip>
                )}
              </div>
            </div>

            {/* The three facts that answer "who is this?" at a glance. */}
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-eavi-muted-text">{copy.profile.groups.academic}</dt>
                <dd className="min-w-0 text-sm font-medium break-words">
                  {activeEnrollment
                    ? `${activeEnrollment.program.name} (${activeEnrollment.program.code})`
                    : common.notSet}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-eavi-muted-text">{copy.profile.enrolled}</dt>
                <dd className="text-sm font-medium">
                  {activeEnrollment ? formatDate(activeEnrollment.enrolledAt) : common.notSet}
                  {activeEnrollment?.period?.name ? (
                    <span className="ml-1.5 text-eavi-muted-text">· {activeEnrollment.period.name}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Panel>

      {/* Changing the photograph marks the saved card and record stale; the worker puts it
          into both. There is no "regenerate card" step on this page. */}
      <Panel title="Student photograph">
        <form action={updateStudentPhoto} className="flex flex-wrap items-end gap-4 p-4">
          <input type="hidden" name="studentId" value={student.id} />
          <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-eavi-primary-text">New photograph</span>
            <input
              type="file"
              name="photo"
              accept="image/*"
              required
              className="min-h-11 w-full rounded-lg border border-eavi-border bg-eavi-card px-3 py-2 text-sm"
            />
          </label>
          <SubmitButton label="Save photograph" />
          <p className="w-full text-xs text-eavi-muted-text">
            The ID card and student record update themselves after this is saved.
          </p>
        </form>
      </Panel>

      {/* Details grouped by what they are about. A field with nothing in it is dropped
          rather than printed as "Not recorded" ten times, and the count of what is missing
          is stated once so the gap is still visible without filling the page with dashes. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {detailGroups.map((group) => (
          <Panel key={group.title} title={group.title}>
            <div className="p-4">
              {group.rows.length === 0 ? (
                <p className="text-sm text-eavi-muted-text">
                  {group.empty}
                </p>
              ) : (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {group.rows.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <dt className="text-xs text-eavi-muted-text">{row.label}</dt>
                      <dd className="min-w-0 text-sm break-words">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Panel>
        ))}
      </div>

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
        <StatTile label={feeCopy.totalFees} value={moneyExact(billed)} icon="accounts" tone="neutral" />
        <StatTile label={feeCopy.paid} value={moneyExact(collected)} icon="accounts" tone="money" />
        <StatTile
          label={feeCopy.outstanding}
          value={moneyExact(outstanding)}
          icon="accounts"
          tone="attention"
          hint={credit > 0 ? `Credit due: ${moneyExact(credit)}` : undefined}
        />
        <StatTile
          label={feeCopy.nextDue}
          value={nextDue ? moneyExact(nextDue.outstanding) : feeCopy.settled}
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
            <p className="text-sm text-eavi-muted-text">
              Invoices are raised automatically from the published fee plan when a
              student is enrolled. They appear here as soon as a plan exists.
            </p>
          </div>
        ) : (
          <>
            <DataTable
              columns={feeCopy.columns as Column[]}
              rows={feeTableRows}
              caption={feeCopy.obligations}
            />
            <div className="flex flex-wrap items-center gap-4 border-t border-eavi-border p-4">
              {/* Payments are recorded in ONE place: the Accounts page's guided wizard.
                  The overdue line stays here so the eye lands on the debt it belongs to. */}
              {overdueRows.length > 0 ? (
                <p className="text-sm text-eavi-destructive">
                  {feeCopy.overdue}: {moneyExact(overdueAmount)} —{" "}
                  <a href="/dashboard/accounts" className="underline underline-offset-4">
                    record the payment there
                  </a>
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

      <Panel
        title={academicCopy.title}
        description={
          activeEnrollment
            ? `${academicCopy.progress(completedUnits, units.length)} · ${academicCopy.currentPeriod}: ${
                currentUnit?.programUnit.periodLabel ?? academicCopy.empty
              }`
            : undefined
        }
      >
        {!activeEnrollment || units.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text">{academicCopy.empty}</p>
        ) : (
          <>
            <div className="border-b border-eavi-border p-4">
              <DisclosureForm
                id={`register-period-${activeEnrollment.id}`}
                button={academicCopy.register}
                title={academicCopy.registerTitle}
                fields={registerFields}
                hidden={{ enrollmentId: activeEnrollment.id }}
                action={registerUnitPeriod}
                submitLabel={academicCopy.register}
              />
            </div>

            <DataTable
              columns={academicCopy.columns as Column[]}
              rows={unitRows}
              caption={academicCopy.title}
            />
          </>
        )}
      </Panel>

      <Panel title={attachmentCopy.studentTitle}>
        {attachmentRows.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text">{attachmentCopy.studentEmpty}</p>
        ) : (
          <DataTable
            columns={attachmentCopy.studentColumns as Column[]}
            rows={attachmentRows}
            caption={attachmentCopy.studentTitle}
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

      {/* The paper record. It sits OUTSIDE the screen container, because that container is
          hidden in print — nesting the document inside it is what previously left the sheet
          blank. Hidden on screen, shown by the print stylesheet, and also what the server
          renders into a PDF at /api/students/[id]/print. */}
      <StudentPrintDocument student={printStudent} />
    </>
  );
}
