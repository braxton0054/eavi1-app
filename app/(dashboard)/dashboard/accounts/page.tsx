import {
  addInvoiceLine,
  createInvoice,
  recordPayment,
  voidInvoice,
} from "@/lib/actions/college/accounts";
import {
  getAccounts,
  getInvoiceOptions,
  getStudentOptions,
  getSemesterOptions,
} from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm, type OptionSets } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel, StatTile } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
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

  const [list, studentOptions, semesterOptions, invoiceOptions] = await Promise.all([
    getAccounts({ q, status, page: Number(page) || 1 }),
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

  const columns: Column[] = [...copy.invoiceColumns, { key: "actions", label: common.actions }];

  const rows: Row[] = list.rows.map((invoice) => ({
    id: invoice.id,
    cells: {
      number: invoice.number,
      student: `${invoice.student.admissionNo} · ${invoice.student.user.fullName}`,
      issued: formatDate(invoice.createdAt),
      dueAt: invoice.dueAt ? formatDate(invoice.dueAt) : common.notSet,
      total: money(invoice.billed),
      paid: money(invoice.paid),
      balance: (
        <span className={invoice.balance > 0 ? "text-eavi-destructive" : undefined}>
          {money(invoice.balance)}
        </span>
      ),
      status: (
        <StatusChip tone={invoiceTone[invoice.status] ?? "neutral"}>
          {labels.invoiceStatus[invoice.status]}
        </StatusChip>
      ),
      actions: (
        <div className="flex flex-wrap items-start gap-2">
          <details>
            <summary className={detail}>{copy.create.linesHeading}</summary>
            <div className="mt-2 w-72 max-w-full rounded-xl border border-eavi-border bg-eavi-card p-3 text-xs shadow-eavi-card">
              {invoice.lines.length === 0 ? (
                <p className="text-eavi-muted-text">{common.none}</p>
              ) : (
                <ul className="space-y-1">
                  {invoice.lines.map((line) => (
                    <li key={line.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 leading-tight sm:truncate">{line.label}</span>
                      <span className="shrink-0 tabular-nums">{money(line.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 font-semibold text-eavi-muted-text">{copy.summary.collected}</p>
              {invoice.payments.length === 0 ? (
                <p className="mt-1 text-eavi-muted-text">{common.none}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span>{labels.paymentMethod[payment.method]}</span>
                      <span className="tabular-nums">{money(payment.amount)}</span>
                      {payment.reference ? (
                        <span className="text-eavi-muted-text">{payment.reference}</span>
                      ) : null}
                      <span className="text-eavi-muted-text tabular-nums">
                        {formatDate(payment.paidAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <RowForm
            id={`invoice-${invoice.id}-line`}
            button={copy.create.lineAdd.label}
            fields={copy.create.lineFields}
            hidden={{ invoiceId: invoice.id }}
            action={addInvoiceLine}
            submitLabel={common.create}
          />

          {invoice.status === "VOID" ? null : (
            <RowForm
              id={`invoice-${invoice.id}-void`}
              button={copy.void.button}
              fields={[]}
              hidden={{ invoiceId: invoice.id }}
              action={voidInvoice}
              submitLabel={copy.void.button}
              tone="danger"
            />
          )}
        </div>
      ),
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

      <DisclosureForm
        id="new-invoice"
        button={copy.create.button}
        title={copy.create.title}
        fields={copy.create.fields}
        options={options}
        action={createInvoice}
        submitLabel={common.create}
      />

      <DisclosureForm
        id="new-payment"
        button={copy.payment.button}
        title={copy.payment.title}
        fields={copy.payment.fields}
        options={options}
        action={recordPayment}
        submitLabel={common.record}
      />

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

        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="accounts" />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} caption={copy.title} />
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
