import { pages } from "@/lib/content/dashboard";

/**
 * The printed student record.
 *
 * This is a separate document from the screen version, not the screen version restyled.
 * A web page is read by scrolling and tapping; a sheet of A4 has fixed pages, one left edge
 * and no way to hide anything behind a disclosure. Building it as its own markup means the
 * print output cannot inherit the app's nav, buttons, stat tiles or card grid — the four
 * things that were ruining the PDF.
 *
 * Everything here is measured in millimetres, because paper is a physical object: the page
 * box, the photo, the column widths and the gaps. Pixels would render differently on every
 * machine that opened the PDF.
 */

const printCopy = pages.students.profile.print;

export type PrintFact = { label: string; value: string };

export type PrintInvoice = {
  id: string;
  period: string;
  invoice: string;
  due: string;
  amount: string;
  paid: string;
  balance: string;
  status: string;
  /** True when the balance is still owed, so the row can be marked as such. */
  owed: boolean;
};

export type PrintPayment = {
  id: string;
  date: string;
  receipt: string;
  appliedTo: string;
  method: string;
  reference: string;
  amount: string;
};

/** A table is a list of cells, oldest or first row first. */
export type PrintCells = string[];

export type PrintStudent = {
  fullName: string;
  admissionNo: string;
  status: string;
  programme: string;
  enrolled: string;
  photoUrl: string | null;
  contact: PrintFact[];
  personal: PrintFact[];
  guardian: PrintFact[];
  enrollments: PrintCells[];
  totals: { billed: string; paid: string; outstanding: string; nextDue: string };
  settledLine: string;
  invoices: PrintInvoice[];
  overdueTotal: string | null;
  payments: PrintPayment[];
  units: PrintCells[];
  attachments: PrintCells[];
  cards: PrintCells[];
};

export function StudentPrintDocument({ student }: { student: PrintStudent }) {
  return (
    <article className="print-doc" aria-hidden>
      {/* ---------------------------------------------------------------- page 1 */}

      <section className="print-section print-identity">
        <header className="print-masthead">
          <div className="print-masthead-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="print-logo" />
            <div>
              <p className="print-institute">East Africa Vision Institute</p>
              <p className="print-doctype">{printCopy.title}</p>
            </div>
          </div>
          <p className="print-subject">
            {student.fullName} · {student.admissionNo}
          </p>
        </header>

        <div className="print-person">
          {student.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={student.photoUrl} alt="" className="print-photo" />
          ) : (
            <div className="print-photo print-photo-empty">{printCopy.noPhoto}</div>
          )}

          <dl className="print-facts print-facts-identity">
            <Fact label="Admission number" value={student.admissionNo} />
            <Fact label="Status" value={student.status} />
            <Fact label="Programme" value={student.programme} />
            <Fact label="Enrolled" value={student.enrolled} />
          </dl>
        </div>

        {/* Contact and Personal sit side by side; Guardian runs full width beneath them.
            Both columns start at the same left edge as every other section. */}
        <div className="print-split">
          <div>
            <h3>Contact</h3>
            <FactList rows={student.contact} />
          </div>
          <div>
            <h3>Personal</h3>
            <FactList rows={student.personal} />
          </div>
        </div>

        <h3>Guardian</h3>
        <FactList rows={student.guardian} muted />

        <h3>Enrolments</h3>
        <PrintTable
          caption="Enrolments"
          head={["Programme", "Intake", "Cohort", "Status", "Enrolled"]}
          rows={student.enrollments}
          empty="No enrolments recorded."
        />
      </section>

      {/* ---------------------------------------------------------------- page 2 */}

      {/* Finance starts a fresh page only when it is long enough to need one; a student with
          two invoices would otherwise leave half of page 1 empty. */}
      <section className="print-section print-finance print-flow">
        <h2>{printCopy.finance}</h2>

        <div className="print-stats">
          <Stat label="Total programme fees" value={student.totals.billed} />
          <Stat label="Paid" value={student.totals.paid} />
          <Stat label="Outstanding" value={student.totals.outstanding} />
          <Stat label="Next payment" value={student.totals.nextDue} />
        </div>
        <p className="print-settled">{student.settledLine}</p>

        <h3>{printCopy.schedule}</h3>
        <PrintTable
          caption={printCopy.schedule}
          head={[
            printCopy.columns.period,
            printCopy.columns.invoice,
            printCopy.columns.due,
            printCopy.columns.amount,
            printCopy.columns.paid,
            printCopy.columns.balance,
            printCopy.columns.status,
          ]}
          rows={student.invoices.map((invoice) => ({
            id: invoice.id,
            cells: [
              invoice.period,
              invoice.invoice,
              invoice.due,
              invoice.amount,
              invoice.paid,
              invoice.balance,
              invoice.status,
            ],
            right: [3, 4, 5],
          }))}
          empty="No fee schedule has been generated for this student yet."
          foot={
            student.overdueTotal
              ? [
                  { cells: [printCopy.overdueTotal, student.overdueTotal], span: 5 },
                ]
              : null
          }
        />

        {/* The history table may continue onto a page of its own; its head repeats, and no
            row is ever split, so a payment is always whole on whichever page it lands. */}
        <h3>{printCopy.history}</h3>
        <PrintTable
          caption={printCopy.history}
          head={[
            printCopy.columns.date,
            printCopy.columns.receipt,
            printCopy.columns.appliedTo,
            printCopy.columns.method,
            printCopy.columns.reference,
            printCopy.columns.amount,
          ]}
          rows={student.payments.map((payment) => ({
            id: payment.id,
            cells: [
              payment.date,
              payment.receipt,
              payment.appliedTo,
              payment.method,
              payment.reference,
              payment.amount,
            ],
            right: [5],
          }))}
          empty="No payments recorded yet."
        />
      </section>

      {/* ------------------------------------------------------------- page 3, if needed */}

      <section className="print-section print-progress">
        <h2>{printCopy.outreach}</h2>

        <h3>Academic progress</h3>
        <PrintTable
          caption="Academic progress"
          head={[printCopy.columns.unit, "Period", "Status", printCopy.columns.result]}
          rows={student.units}
          empty="No units registered yet."
        />

        <h3>Industrial attachment</h3>
        <PrintTable
          caption="Industrial attachment"
          head={[printCopy.columns.stage, "Status", printCopy.columns.host, "Dates", printCopy.columns.result]}
          rows={student.attachments}
          empty="No attachment stages recorded."
        />

        <h3>Cards</h3>
        <PrintTable
          caption="Cards"
          head={[printCopy.columns.serial, "Status", printCopy.columns.issued, printCopy.columns.expires]}
          rows={student.cards}
          empty="No cards issued."
        />
      </section>
    </article>
  );
}

function Fact({ label, value }: PrintFact) {
  return (
    <div className="print-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Label/value pairs, left-aligned in both columns.
 *
 * An empty list says so once in muted text rather than printing "Not recorded" for every
 * field, which is what made the old sheet look like a form nobody had filled in.
 */
function FactList({ rows, muted }: { rows: PrintFact[]; muted?: boolean }) {
  if (rows.length === 0) {
    return <p className={muted ? "print-empty print-muted" : "print-empty"}>{printCopy.nothingRecorded}</p>;
  }
  return (
    <dl className="print-facts">
      {rows.map((row) => (
        <Fact key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-stat">
      <p className="print-stat-label">{label}</p>
      <p className="print-stat-value">{value}</p>
    </div>
  );
}

type PrintRow = { id: string; cells: (string | number)[]; right?: number[] };
type PrintFootRow = { cells: string[]; span?: number };

/**
 * A real table, with a real `<thead>`.
 *
 * `display: table-header-group` on the head means that if a table must run onto another
 * page, the column names go with it instead of the reader meeting bare numbers.
 */
function PrintTable({
  caption,
  head,
  rows,
  empty,
  foot,
}: {
  caption: string;
  head: string[];
  rows: PrintCells[] | PrintRow[];
  empty: string;
  foot?: PrintFootRow[] | null;
}) {
  // A row may arrive as bare cells or with its own id and alignment; both print the same.
  const normalised: PrintRow[] = rows.map((row, index) =>
    Array.isArray(row)
      ? { id: String(index), cells: row.map((value) => (value ? String(value) : "—")) }
      : (row as PrintRow),
  );

  if (normalised.length === 0) {
    return <p className="print-empty">{empty}</p>;
  }

  return (
    <table className="print-table">
      <caption className="print-sr">{caption}</caption>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {normalised.map((row) => (
          <tr key={row.id}>
            {row.cells.map((cell, index) => {
              // Money is right-aligned because figures are compared by their digits, and
              // every other cell keeps the document's one left edge.
              const alignRight = row.right?.includes(index);
              return (
                <td key={index} className={alignRight ? "num" : undefined}>
                  {cell}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      {foot ? (
        <tfoot>
          {foot.map((row) => (
            <tr key={row.cells[0]}>
              <th scope="row" colSpan={row.span ?? 1} className="foot-label">
                {row.cells[0]}
              </th>
              <td className="num" colSpan={head.length - (row.span ?? 1)}>
                {row.cells[1]}
              </td>
            </tr>
          ))}
        </tfoot>
      ) : null}
    </table>
  );
}

