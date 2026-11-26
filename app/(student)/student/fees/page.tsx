import { getStudentFees } from "@/lib/dal/student-portal";
import { labels, studentPortal } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { sumAmounts } from "@/lib/fees/ledger";

const copy = studentPortal.fees;

const kwacha = (value: number) =>
  `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const invoiceTone: Record<string, ChipTone> = {
  PAID: "success",
  PARTIAL: "warning",
  OPEN: "danger",
  CREDIT: "info",
  VOID: "neutral",
};

export default async function StudentFeesPage() {
  const { enrollment, invoices, payments, totals } = await getStudentFees();
  const creditDue = totals.balance < 0;

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {!enrollment ? (
        <EmptyState
          title={studentPortal.home.noEnrolment.title}
          body={studentPortal.home.noEnrolment.body}
          icon="accounts"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label={copy.total} value={kwacha(totals.billed)} icon="accounts" />
            <MetricCard label={copy.paid} value={kwacha(totals.paid)} icon="accounts" />
            <MetricCard
              label={creditDue ? "Credit due" : copy.balance}
              value={kwacha(creditDue ? Math.abs(totals.balance) : totals.balance)}
              icon="accounts"
              tone={totals.balance > 0 ? "attention" : "money"}
            />
          </div>

          {/* The printable statement carries the same numbers as these cards, so the
              download lives beside them rather than buried in a menu. */}
          <div className="flex justify-end">
            <Button asChild variant="secondary" size="sm">
              <a href="/student/fees/statement?download=1">{copy.statement}</a>
            </Button>
          </div>

          <Panel title={copy.title}>
            {invoices.length === 0 ? (
              <EmptyState title={copy.title} body={copy.empty} icon="accounts" />
            ) : (
              <ul className="divide-y divide-eavi-border">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-eavi-on-bg">{invoice.number}</p>
                      <p className="mt-0.5 text-sm text-eavi-muted-text">
                        {invoice.periodYear && invoice.periodSemester
                          ? `Year ${invoice.periodYear} · Semester ${invoice.periodSemester}`
                          : copy.title}
                        {invoice.dueAt ? ` · ${formatDate(invoice.dueAt)}` : ""}
                      </p>
                      {/* The invoice is the college's own document design, built from this
                          invoice when it is asked for — nothing is stored per view. */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button asChild variant="secondary" size="sm">
                          <a href={`/student/fees/invoice/${encodeURIComponent(invoice.number)}`}>
                            {copy.invoiceView}
                          </a>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/student/fees/invoice/${encodeURIComponent(invoice.number)}?download=1`}>
                            {copy.invoiceDownload}
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold text-eavi-on-bg tabular-nums">
                        {kwacha(invoice.amount)}
                      </span>
                      <StatusChip tone={invoiceTone[invoice.status] ?? "neutral"}>
                        {labels.invoiceStatus[invoice.status as keyof typeof labels.invoiceStatus] ??
                          invoice.status}
                      </StatusChip>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={copy.paymentsTitle}>
            {payments.length === 0 ? (
              <EmptyState title={copy.paymentsTitle} body={copy.paymentsEmpty} icon="accounts" />
            ) : (
              <ul className="divide-y divide-eavi-border">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-baseline justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm text-eavi-muted-text">{formatDate(payment.paidAt)}</p>
                      {payment.reference ? (
                        <p className="mt-0.5 text-xs text-eavi-muted-text">{payment.reference}</p>
                      ) : null}
                      {payment.receiptNo ? (
                        <p className="mt-1 -mb-2 flex flex-wrap items-center gap-x-3 text-xs">
                          <a
                            href={`/student/fees/receipt/${encodeURIComponent(payment.receiptNo)}`}
                            className="inline-flex min-h-9 items-center text-eavi-primary-text underline-offset-4 hover:underline"
                          >
                            {copy.receipt} {payment.receiptNo}
                          </a>
                          <a
                            href={`/student/fees/receipt/${encodeURIComponent(payment.receiptNo)}?download=1`}
                            className="inline-flex min-h-9 items-center text-eavi-muted-text underline-offset-4 hover:underline"
                          >
                            {copy.receiptDownload}
                          </a>
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-medium text-eavi-on-bg tabular-nums">
                      {kwacha(sumAmounts([payment]))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
