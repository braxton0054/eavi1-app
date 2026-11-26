import Link from "next/link";
import { randomUUID } from "node:crypto";

import {
  addInvoiceLine,
  correctPayment,
  createInvoice,
  issueCreditNote,
  restoreInvoice,
  voidInvoice,
} from "@/lib/actions/college/accounts";
import {
  getAccounts,
  getFinanceOverview,
  getStudentOptions,
  getSemesterOptions,
} from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages, shell } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { RecordCard, RecordCardGrid, type RecordCardData } from "@/components/dashboard/record-card";
import { DisclosureForm, RowForm, type OptionSets } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel, StatTile } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { PaymentWizard } from "@/components/dashboard/payment-wizard";
import { formatDate, moneyExact } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.accounts;
const money = moneyExact;

const invoiceTone: Record<string, ChipTone> = {
  OPEN: "warning",
  PARTIAL: "info",
  PAID: "success",
  CREDIT: "info",
  VOID: "neutral",
};

const detail =
  "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden";

const documentLink =
  "inline-flex min-h-11 items-center rounded-md px-2 text-eavi-primary-text underline-offset-4 hover:bg-eavi-muted hover:underline";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; invalid?: string; reason?: string }>;
}) {
  const { q, status, page, invalid, reason } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [list, finance, studentOptions, semesterOptions] = await Promise.all([
    getAccounts({ q, status, page: Number(page) || 1 }),
    getFinanceOverview(),
    getStudentOptions(scope.campusId),
    getSemesterOptions(),
  ]);
  const options: OptionSets = { students: studentOptions, semesters: semesterOptions };
  const statuses = Object.entries(labels.invoiceStatus).map(([value, label]) => ({ value, label }));

  const tiles = [
    { label: copy.summary.billed, value: money(list.summary.billed), tone: "neutral" as const },
    { label: copy.summary.collected, value: money(list.summary.collected), tone: "money" as const },
    { label: copy.summary.outstanding, value: money(list.summary.outstanding), tone: "attention" as const },
    { label: copy.summary.credit, value: money(list.summary.credit), tone: "money" as const },
    { label: copy.summary.paidCount, value: String(list.summary.paidCount), tone: "neutral" as const },
  ];

  type InvoiceRow = (typeof list.rows)[number];
  const invoiceAction = (invoice: InvoiceRow, prefix: string) => {
    const correctable = invoice.payments.filter(
      (payment) => payment.entryType === "PAYMENT" && payment.receipt.status === "ISSUED",
    );
    const uniqueReceipts = [...new Map(correctable.map((payment) => [payment.receiptId, payment])).values()];

    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <span className="flex flex-wrap items-center gap-1 text-xs">
          <a href={`/dashboard/accounts/invoice/${encodeURIComponent(invoice.number)}`} className={documentLink}>
            {copy.card.view}
          </a>
          <a
            href={`/dashboard/accounts/invoice/${encodeURIComponent(invoice.number)}?download=1`}
            className={`${documentLink} text-eavi-muted-text`}
          >
            {copy.card.download}
          </a>
        </span>

        <details className="min-w-0">
          <summary className={detail}>{copy.card.details}</summary>
          <div className="mt-2 w-[20rem] max-w-full rounded-xl border border-eavi-border bg-eavi-card p-3 text-xs">
            <p className="font-semibold text-eavi-muted-text">{copy.card.lines}</p>
            {invoice.lines.length === 0 ? (
              <p className="mt-1 text-eavi-muted-text">{copy.card.noLines}</p>
            ) : (
              <ul className="mt-1 space-y-2">
                {invoice.lines.map((line) => (
                  <li key={line.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 leading-tight">
                      {line.label}
                      <span className="block text-eavi-muted-text">
                        {labels.invoiceLineKind[line.kind]}
                        {line.reference ? ` · ${line.reference}` : ""}
                        {line.reason ? ` · ${line.reason}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{money(line.amount)}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 font-semibold text-eavi-muted-text">{copy.card.payments}</p>
            {invoice.payments.length === 0 ? (
              <p className="mt-1 text-eavi-muted-text">{copy.card.noPayments}</p>
            ) : (
              <ul className="mt-1 space-y-2">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span>{labels.paymentMethod[payment.method]}</span>
                    <span className="tabular-nums">{money(payment.amount)}</span>
                    <span className="text-eavi-muted-text">{labels.paymentEntryType[payment.entryType]}</span>
                    {payment.reference ? <span className="text-eavi-muted-text">{payment.reference}</span> : null}
                    <span className="text-eavi-muted-text tabular-nums">{formatDate(payment.paidAt)}</span>
                    {payment.reason ? <span className="w-full text-eavi-muted-text">{payment.reason}</span> : null}
                    <a
                      href={`/dashboard/accounts/receipt/${encodeURIComponent(payment.receiptNo)}`}
                      className="inline-flex min-h-11 items-center text-eavi-primary-text underline-offset-4 hover:underline"
                    >
                      {copy.card.receipt} {payment.receiptNo} · {labels.receiptStatus[payment.receipt.status]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {invoice.status === "VOID" && invoice.voidReason ? (
              <p className="mt-3 text-eavi-muted-text">Void reason: {invoice.voidReason}</p>
            ) : null}
          </div>
        </details>

        {invoice.status !== "VOID" ? (
          <>
            <RowForm
              id={`${prefix}-${invoice.id}-line`}
              button={copy.card.addLine}
              fields={copy.create.lineFields}
              hidden={{ invoiceId: invoice.id }}
              action={addInvoiceLine}
              submitLabel={common.create}
            />
            <RowForm
              id={`${prefix}-${invoice.id}-credit`}
              button={copy.card.creditNote}
              fields={[copy.corrections.creditAmount, copy.corrections.reason, copy.corrections.effectiveAt]}
              hidden={{ invoiceId: invoice.id, idempotencyKey: randomUUID() }}
              action={issueCreditNote}
              submitLabel={copy.card.creditNote}
              aside={<p className="text-xs text-eavi-muted-text">{copy.corrections.creditHint}</p>}
              wide
            />
            <RowForm
              id={`${prefix}-${invoice.id}-void`}
              button={copy.card.void}
              fields={[copy.corrections.reason]}
              hidden={{ invoiceId: invoice.id }}
              action={voidInvoice}
              submitLabel={copy.card.void}
              tone="danger"
              aside={<p className="text-xs text-eavi-muted-text">{copy.corrections.voidHint}</p>}
            />
          </>
        ) : (
          <RowForm
            id={`${prefix}-${invoice.id}-restore`}
            button={copy.card.restore}
            fields={[copy.corrections.reason]}
            hidden={{ invoiceId: invoice.id }}
            action={restoreInvoice}
            submitLabel={copy.card.restore}
          />
        )}

        {uniqueReceipts.map((payment) => (
          <RowForm
            key={payment.receiptId}
            id={`${prefix}-${invoice.id}-correct-${payment.id}`}
            button={copy.card.correctPayment}
            fields={[
              copy.corrections.correctionKind,
              copy.corrections.reason,
              copy.corrections.effectiveAt,
              copy.corrections.reference,
            ]}
            hidden={{ paymentId: payment.id, idempotencyKey: randomUUID() }}
            action={correctPayment}
            submitLabel={copy.card.correctPayment}
            tone="danger"
            wide
            aside={<p className="text-xs text-eavi-muted-text">{copy.corrections.reverseHint} Receipt: {payment.receiptNo}.</p>}
          />
        ))}
      </div>
    );
  };

  const cards: RecordCardData[] = list.rows.map((invoice) => ({
    id: invoice.id,
    href: `/dashboard/students/${invoice.student.id}`,
    eyebrow: invoice.number,
    title: invoice.student.user.fullName,
    subtitle: invoice.student.admissionNo,
    status: (
      <StatusChip tone={invoiceTone[invoice.status] ?? "neutral"}>
        {labels.invoiceStatus[invoice.status]}
      </StatusChip>
    ),
    facts: [
      { label: copy.card.issued, value: formatDate(invoice.createdAt), showLabel: true },
      { label: copy.card.due, value: invoice.dueAt ? formatDate(invoice.dueAt) : common.notSet, showLabel: true },
      { label: copy.card.billed, value: money(invoice.billed), showLabel: true },
      { label: copy.card.paid, value: money(invoice.paid), showLabel: true, tone: "muted" },
    ],
    figure: {
      label: copy.card.balance,
      value: invoice.balance > 0
        ? money(invoice.balance)
        : invoice.balance < 0
          ? `${copy.card.creditDue} ${money(Math.abs(invoice.balance))}`
          : copy.card.settled,
      danger: invoice.balance > 0,
    },
    action: invoiceAction(invoice, `mobile-${invoice.id}`),
  }));

  const financeProgramRows: Row[] = finance.byProgram.map((row) => ({
    id: row.name,
    cells: {
      name: row.name,
      expected: money(row.expected),
      collected: money(row.collected),
      outstanding: money(row.outstanding),
    },
  }));
  const financePeriodRows: Row[] = finance.byPeriod.map((row) => ({
    id: row.name,
    cells: {
      name: row.name,
      expected: money(row.expected),
      collected: money(row.collected),
      outstanding: money(row.outstanding),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        action={
          <Link
            href="/dashboard/accounts/history"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:bg-eavi-muted hover:underline"
          >
            View payment history
          </Link>
        }
      />
      {invalid ? <Notice tone="warning" title={common.errorTitle} body={reason?.slice(0, 400) || common.invalidSubmit} /> : null}

      <section aria-label={copy.title} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile) => <StatTile key={tile.label} label={tile.label} value={tile.value} icon="accounts" tone={tile.tone} />)}
      </section>

      <section aria-label={copy.finance.title} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label={copy.finance.expected} value={money(finance.totals.expected)} icon="accounts" tone="neutral" />
        <StatTile label={copy.finance.collected} value={money(finance.totals.collected)} icon="accounts" tone="money" />
        <StatTile label={copy.finance.outstanding} value={money(finance.totals.outstanding)} icon="accounts" tone="attention" />
        <StatTile label={copy.finance.credit} value={money(finance.totals.credit)} icon="accounts" tone="money" />
        <StatTile label={copy.finance.overdue} value={money(finance.totals.overdue)} icon="calendar" tone="attention" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={copy.finance.byProgram} description={copy.finance.overdueCount(finance.totals.overdueCount)}>
          {financeProgramRows.length === 0 ? (
            <p className="p-4 text-sm text-eavi-muted-text">{copy.finance.empty}</p>
          ) : (
            <DataTable columns={copy.finance.columns as Column[]} rows={financeProgramRows} caption={copy.finance.byProgram} />
          )}
        </Panel>
        <Panel title={copy.finance.byPeriod} description={copy.finance.description}>
          {financePeriodRows.length === 0 ? (
            <p className="p-4 text-sm text-eavi-muted-text">{copy.finance.byPeriodEmpty}</p>
          ) : (
            <DataTable columns={copy.finance.periodColumns as Column[]} rows={financePeriodRows} caption={copy.finance.byPeriod} />
          )}
        </Panel>
      </div>

      {scope.campusId !== null ? (
        <DisclosureForm
          id="new-invoice"
          button={copy.create.button}
          title={copy.create.title}
          fields={copy.create.fields}
          options={options}
          action={createInvoice}
          submitLabel={common.create}
        />
      ) : (
        <Notice tone="neutral" title={copy.create.button} body={shell.chooseCampus} />
      )}

      <Panel title={copy.payment.student.title} description={copy.payment.student.hint}>
        <PaymentWizard students={studentOptions} campusLocked={scope.campusId === null} />
      </Panel>

      <Panel title={copy.title}>
        <div className="space-y-4 p-4">
          <ListFilters basePath="/dashboard/accounts" q={q} status={status} statuses={statuses} searchLabel={copy.searchLabel} />
          <ResultCount total={list.total} />
        </div>
        {cards.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="accounts" />
        ) : (
          <>
            <DataTable
              columns={[
                { key: "invoice", label: "Invoice" },
                { key: "status", label: "Status" },
                { key: "issued", label: "Issued" },
                { key: "due", label: "Due" },
                { key: "billed", label: "Billed", align: "end" },
                { key: "paid", label: "Paid", align: "end" },
                { key: "balance", label: "Balance", align: "end" },
                { key: "actions", label: copy.card.actions, interactive: true },
              ]}
              rows={list.rows.map((invoice): Row => ({
                id: invoice.id,
                href: `/dashboard/students/${invoice.student.id}`,
                cells: {
                  invoice: (
                    <span className="block">
                      <span className="font-medium">{invoice.student.user.fullName}</span>
                      <span className="block text-xs text-eavi-muted-text">{invoice.number}</span>
                    </span>
                  ),
                  status: <StatusChip tone={invoiceTone[invoice.status] ?? "neutral"}>{labels.invoiceStatus[invoice.status]}</StatusChip>,
                  issued: formatDate(invoice.createdAt),
                  due: invoice.dueAt ? formatDate(invoice.dueAt) : common.notSet,
                  billed: money(invoice.billed),
                  paid: money(invoice.paid),
                  balance: invoice.balance > 0
                    ? money(invoice.balance)
                    : invoice.balance < 0
                      ? `${copy.card.creditDue} ${money(Math.abs(invoice.balance))}`
                      : copy.card.settled,
                  actions: invoiceAction(invoice, `desktop-${invoice.id}`),
                },
              }))}
              caption={copy.title}
              mobile={<RecordCardGrid>{cards.map((card) => <RecordCard key={card.id} card={card} openLabel={copy.card.open} />)}</RecordCardGrid>}
            />
            <div className="border-t border-eavi-border p-4">
              <Paginator basePath="/dashboard/accounts" page={list.page} total={list.total} q={q} status={status} />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
