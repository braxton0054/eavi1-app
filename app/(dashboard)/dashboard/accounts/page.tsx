import {
  addInvoiceLine,
  createInvoice,
  voidInvoice,
} from "@/lib/actions/college/accounts";
import {
  getAccounts,
  getFinanceOverview,
  getInvoiceOptions,
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
import { formatDate, money } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.accounts;

const invoiceTone: Record<string, ChipTone> = {
  OPEN: "warning",
  PARTIAL: "info",
  PAID: "success",
  VOID: "neutral",
};

/** The same summary control `RowForm` uses, for the read-only line and payment detail. */
const detail =
  "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; invalid?: string }>;
}) {
  const { q, status, page, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [list, finance, studentOptions, semesterOptions, invoiceOptions] = await Promise.all([
    getAccounts({ q, status, page: Number(page) || 1 }),
    getFinanceOverview(),
    getStudentOptions(scope.campusId),
    getSemesterOptions(),
    getInvoiceOptions(scope.campusId),
  ]);

  const options: OptionSets = {
    students: studentOptions,
    semesters: semesterOptions,
    invoices: invoiceOptions,
  };

  const statuses = Object.entries(labels.invoiceStatus).map(([value, label]) => ({
    value,
    label,
  }));

  const tiles = [
    { label: copy.summary.billed, value: money(list.summary.billed), tone: "neutral" as const },
    { label: copy.summary.collected, value: money(list.summary.collected), tone: "money" as const },
    { label: copy.summary.outstanding, value: money(list.summary.outstanding), tone: "attention" as const },
    { label: copy.summary.paidCount, value: String(list.summary.paidCount), tone: "neutral" as const },
  ];

  // One invoice, one card. The card opens the student, because a bill is read against the
  // person and their whole schedule — there is no separate invoice screen to land on.
  const cards: RecordCardData[] = list.rows.map((invoice) => {
    const owing = invoice.balance > 0;

    const action = (
      <div className="flex w-full flex-wrap items-center gap-2">
        {/* The invoice document, and every receipt recorded against it, are built from
            the records on demand — no stored copy to fall out of date. */}
        <span className="flex flex-wrap items-center gap-1 text-xs">
          <a
            href={`/dashboard/accounts/invoice/${encodeURIComponent(invoice.number)}`}
            className="inline-flex min-h-9 items-center rounded-md px-2 text-eavi-primary-text underline-offset-4 hover:bg-eavi-muted hover:underline"
          >
            {copy.card.view}
          </a>
          <a
            href={`/dashboard/accounts/invoice/${encodeURIComponent(invoice.number)}?download=1`}
            className="inline-flex min-h-9 items-center rounded-md px-2 text-eavi-muted-text underline-offset-4 hover:bg-eavi-muted hover:underline"
          >
            {copy.card.download}
          </a>
        </span>

        <details className="min-w-0">
          <summary className={detail}>
            {copy.card.details}
          </summary>
          <div className="mt-2 w-[18rem] max-w-full rounded-xl border border-eavi-border bg-eavi-card p-3 text-xs">
            <p className="font-semibold text-eavi-muted-text">{copy.card.lines}</p>
            {invoice.lines.length === 0 ? (
              <p className="mt-1 text-eavi-muted-text">{copy.card.noLines}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {invoice.lines.map((line) => (
                  <li key={line.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 leading-tight">{line.label}</span>
                    <span className="shrink-0 tabular-nums">{money(line.amount)}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 font-semibold text-eavi-muted-text">{copy.card.payments}</p>
            {invoice.payments.length === 0 ? (
              <p className="mt-1 text-eavi-muted-text">{copy.card.noPayments}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span>{labels.paymentMethod[payment.method]}</span>
                    <span className="tabular-nums">{money(payment.amount)}</span>
                    {payment.reference ? (
                      <span className="text-eavi-muted-text">{payment.reference}</span>
                    ) : null}
                    <span className="text-eavi-muted-text tabular-nums">{formatDate(payment.paidAt)}</span>
                    {payment.receiptNo ? (
                      <a
                        href={`/dashboard/accounts/receipt/${encodeURIComponent(payment.receiptNo)}`}
                        className="inline-flex min-h-9 items-center text-eavi-primary-text underline-offset-4 hover:underline"
                      >
                        {copy.card.receipt} {payment.receiptNo}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        <RowForm
          id={`invoice-${invoice.id}-line`}
          button={copy.card.addLine}
          fields={copy.create.lineFields}
          hidden={{ invoiceId: invoice.id }}
          action={addInvoiceLine}
          submitLabel={common.create}
        />

        {invoice.status === "VOID" ? null : (
          <RowForm
            id={`invoice-${invoice.id}-void`}
            button={copy.card.void}
            fields={[]}
            hidden={{ invoiceId: invoice.id }}
            action={voidInvoice}
            submitLabel={copy.card.void}
            tone="danger"
          />
        )}
      </div>
    );

    return {
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
        value: owing ? money(invoice.balance) : copy.card.settled,
        danger: owing,
      },
      action,
    };
  });

  // Revenue split the two ways the finance desk is asked for it: by programme, and by the
  // academic period the fee fell in.
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
      <PageHeader title={copy.title} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <section aria-label={copy.title} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={tile.value} icon="accounts" tone={tile.tone} />
        ))}
      </section>

      <section aria-label={copy.finance.title} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={copy.finance.expected}
          value={money(finance.totals.expected)}
          icon="accounts"
          tone="neutral"
        />
        <StatTile
          label={copy.finance.collected}
          value={money(finance.totals.collected)}
          icon="accounts"
          tone="money"
        />
        <StatTile
          label={copy.finance.outstanding}
          value={money(finance.totals.outstanding)}
          icon="accounts"
          tone="attention"
        />
        <StatTile
          label={copy.finance.overdue}
          value={money(finance.totals.overdue)}
          icon="calendar"
          tone="attention"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={copy.finance.byProgram}
          description={copy.finance.overdueCount(finance.totals.overdueCount)}
        >
          {financeProgramRows.length === 0 ? (
            <p className="p-4 text-sm text-eavi-muted-text">{copy.finance.empty}</p>
          ) : (
            <DataTable
              columns={copy.finance.columns as Column[]}
              rows={financeProgramRows}
              caption={copy.finance.byProgram}
            />
          )}
        </Panel>

        <Panel title={copy.finance.byPeriod} description={copy.finance.description}>
          {financePeriodRows.length === 0 ? (
            <p className="p-4 text-sm text-eavi-muted-text">{copy.finance.byPeriodEmpty}</p>
          ) : (
            <DataTable
              columns={copy.finance.periodColumns as Column[]}
              rows={financePeriodRows}
              caption={copy.finance.byPeriod}
            />
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

      {/* THE one payment flow: student, semester, money, review, record. The two forms
          this page used to carry (and the copy on every student's page) are folded in
          here — one entry point, one ledger. */}
      <Panel title={copy.payment.student.title} description={copy.payment.student.hint}>
        <PaymentWizard students={studentOptions} campusLocked={scope.campusId === null} />
      </Panel>

      <Panel title={copy.title}>
        <div className="space-y-4 p-4">
          <ListFilters
            basePath="/dashboard/accounts"
            q={q}
            status={status}
            statuses={statuses}
            searchLabel={copy.searchLabel}
          />
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
                { key: "balance", label: "Balance", align: "end" },
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
                  status: (
                    <StatusChip tone={invoiceTone[invoice.status] ?? "neutral"}>
                      {labels.invoiceStatus[invoice.status]}
                    </StatusChip>
                  ),
                  issued: formatDate(invoice.createdAt),
                  due: invoice.dueAt ? formatDate(invoice.dueAt) : common.notSet,
                  billed: money(invoice.billed),
                  balance: invoice.balance > 0 ? money(invoice.balance) : copy.card.settled,
                },
              }))}
              caption={copy.title}
              mobile={<RecordCardGrid>{cards.map((card) => (
                <RecordCard key={card.id} card={card} openLabel={copy.card.open} />
              ))}</RecordCardGrid>}
            />
            <div className="border-t border-eavi-border p-4">
              <Paginator
                basePath="/dashboard/accounts"
                page={list.page}
                total={list.total}
                q={q}
                status={status}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
