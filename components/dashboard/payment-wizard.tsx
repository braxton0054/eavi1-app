"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckIcon, ChevronRightIcon, Loader2Icon, SearchIcon } from "lucide-react";

import { recordWizardPayment } from "@/lib/actions/college/accounts";
import { money } from "@/lib/format";
import { StatusChip } from "@/components/dashboard/status-chip";

import styles from "./payment-wizard.module.css";

/**
 * THE one way a payment is recorded.
 *
 * Five steps, in order: the student, the semester they owe (only semesters with a real
 * invoice on the student's ledger are offered), the money, a review, and the submit.
 * Nothing is written until the confirmation step's button — and after a receipt is
 * issued the wizard is spent, so a double click cannot record a payment twice.
 *
 * This replaces the two separate payment forms this page used to carry and the copy on
 * every student's record page: one flow, one ledger entry point.
 */

type SearchOption = { value: string; label: string };

type Allocation = {
  invoiceId: string;
  number: string;
  year: number | null;
  semester: number | null;
  label: string;
  billed: number;
  paid: number;
  outstanding: number;
  status: string;
  settled: boolean;
};

type StudentSummary = {
  id: string;
  name: string;
  admissionNo: string;
  campus: string;
  program: string | null;
  intake: string | null;
};

type Props = {
  students: SearchOption[];
  /** A campus-scoped administrator raises nothing; the wizard says so instead. */
  campusLocked: boolean;
};

const STEPS = ["Student", "Semester", "Payment", "Review", "Done"] as const;

export function PaymentWizard({ students, campusLocked }: Props) {
  const [step, setStep] = useState(-1); // -1 = the entry button; 0..4 = the flow.
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [applied, setApplied] = useState<Array<{ invoice: string; amount: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  // The student picker: the full list arrives as props; a short filter narrows it.
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 8);
  }, [students, query]);

  const loadAllocations = useCallback(async (studentId: string) => {
    setLoadingAllocations(true);
    setError(null);
    try {
      const res = await fetch(`/dashboard/accounts/allocations/${studentId}`, { cache: "no-store" });
      if (!res.ok) {
        setError("This student could not be loaded on your campus.");
        setAllocations(null);
        return;
      }
      const data = (await res.json()) as { student: StudentSummary; allocations: Allocation[] };
      setStudent(data.student);
      setAllocations(data.allocations);
    } catch {
      setError("The allocations could not be loaded. Try again.");
    } finally {
      setLoadingAllocations(false);
    }
  }, []);

  const selected = allocations?.find((a) => a.invoiceId === allocation?.invoiceId) ?? null;
  const amountValue = Number(amount);
  const amountValid = Number.isFinite(amountValue) && amountValue > 0;
  const afterBalance = selected && amountValid ? Math.max(0, selected.outstanding - amountValue) : null;

  const submit = async () => {
    if (submitting || !student || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("studentId", student.id);
      body.set("invoiceId", selected.invoiceId);
      body.set("amount", amount);
      body.set("method", method);
      body.set("reference", reference);
      body.set("paidAt", paidAt);
      const result = await recordWizardPayment(body);
      if (result.ok) {
        setReceiptNo(result.receiptNo);
        setStep(4);
      } else {
        setError(result.error);
      }
    } catch {
      setError("The payment could not be recorded. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(-1);
    setStudent(null);
    setAllocations(null);
    setAllocation(null);
    setAmount("");
    setMethod("");
    setReference("");
    setReceiptNo(null);
    setApplied([]);
    setError(null);
  };

  // The wizard's step rail, rendered for every step.
  const rail = (
    <ol className={styles.rail}>
      {STEPS.map((label, index) => (
        <li
          key={label}
          className={styles.railStep}
          data-state={receiptNo ? "done" : index === step ? "current" : index < step ? "done" : "todo"}
        >
          <span className={styles.railIndex}>{receiptNo || index < step ? <CheckIcon aria-hidden /> : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );

  // The entry state: one clear button — the flow starts when the office asks for it.
  if (step === -1) {
    return (
      <div className={styles.root}>
        {campusLocked ? (
          <p className={styles.note}>Choose a campus from the College overview to record payments.</p>
        ) : (
          <>
            <p className={styles.note}>
              Guided flow: find the student, see their fee status per term, pay against a
              semester or module, review, record. The receipt number appears at the end.
            </p>
            <button type="button" className={styles.confirm} onClick={() => setStep(0)}>
              <SearchIcon aria-hidden /> Record fee payment
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {rail}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {/* Step 1 — the student */}
      {step === 0 && (
        <div className={styles.stepBody}>
          {campusLocked ? (
            <p className={styles.note}>Choose a campus from the College overview to record payments.</p>
          ) : (
            <>
              <label className={styles.label} htmlFor="wizard-student-search">
                Find the student (name or admission number)
              </label>
              <div className={styles.searchRow}>
                <SearchIcon aria-hidden className={styles.searchIcon} />
                <input
                  id="wizard-student-search"
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. 2026/0042 or Faith"
                  autoComplete="off"
                />
              </div>
              <ul className={styles.results}>
                {filtered.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      className={styles.result}
                      onClick={() => {
                        void loadAllocations(option.value);
                      }}
                    >
                      {option.label}
                      <ChevronRightIcon aria-hidden className={styles.chev} />
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className={styles.empty}>No student matches.</li>}
              </ul>
              {loadingAllocations && (
                <p className={styles.loading}>
                  <Loader2Icon aria-hidden className={styles.spin} /> Loading their ledger…
                </p>
              )}
              {student && allocations && (
                <div className={styles.picked}>
                  <p className={styles.pickedName}>{student.name}</p>
                  <p className={styles.pickedMeta}>
                    {student.admissionNo} · {student.program ?? "—"} · {student.intake ?? "—"}
                  </p>
                  <p className={styles.pickedMeta}>
                    {allocations.length === 0
                      ? "No unpaid semester on their ledger — nothing to record."
                      : `${allocations.length} semester${allocations.length === 1 ? "" : "s"} with a balance.`}
                  </p>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={allocations.length === 0}
                    onClick={() => setStep(1)}
                  >
                    Continue
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2 — the fee status per term, and where this payment lands */}
      {step === 1 && (
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>
            {student?.name} — fee status per term. Pick the term this payment starts at
          </p>
          <ul className={styles.allocations}>
            {allocations?.map((a) => (
              <li key={a.invoiceId}>
                {a.settled ? (
                  <div className={styles.allocation} data-settled="true">
                    <span className={styles.allocLabel}>
                      {a.label}
                      <span className={styles.allocNumber}>{a.number}</span>
                    </span>
                    <span className={styles.allocOutstanding} data-done="true">
                      <StatusChip tone="success">Completed</StatusChip>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.allocation}
                    aria-pressed={allocation?.invoiceId === a.invoiceId}
                    onClick={() => setAllocation(a)}
                  >
                    <span className={styles.allocLabel}>
                      {a.label}
                      <span className={styles.allocNumber}>{a.number}</span>
                    </span>
                    <span className={styles.allocOutstanding}>
                      {a.status === "PARTIAL" ? "Part paid · " : "Unpaid · "}
                      {money(a.outstanding)}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          {selected && (
            <p className={styles.summaryLine}>
              {money(selected.billed)} billed · {money(selected.paid)} paid ·{" "}
              {money(selected.outstanding)} outstanding on {selected.label}. Anything above
              the outstanding rolls to the next term automatically.
            </p>
          )}
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={() => setStep(0)}>
              Back
            </button>
            <button type="button" className={styles.primary} disabled={!selected} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — the money */}
      {step === 2 && (
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>
            Paying {selected?.label} — {money(selected?.outstanding ?? 0)} outstanding on it
          </p>
          <label className={styles.label} htmlFor="wizard-amount">
            Amount received (KES) — any extra moves to the next term
          </label>
          <input
            id="wizard-amount"
            className={styles.input}
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {selected && amountValid && amountValue > selected.outstanding && (
            <p className={styles.warn}>
              More than the outstanding on {selected.label} ({money(selected.outstanding)}) — the
              balance rolls to the student&apos;s next unpaid term automatically.
            </p>
          )}
          <label className={styles.label} htmlFor="wizard-method">
            Method
          </label>
          <select id="wizard-method" className={styles.input} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">—</option>
            <option value="MPESA">M-PESA</option>
            <option value="BANK">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
          </select>
          <label className={styles.label} htmlFor="wizard-ref">
            Transaction / reference number
          </label>
          <input
            id="wizard-ref"
            className={styles.input}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. the M-PESA code"
          />
          <label className={styles.label} htmlFor="wizard-date">
            Payment date
          </label>
          <input
            id="wizard-date"
            className={styles.input}
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={!amountValid || !method}
              onClick={() => setStep(3)}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — the review */}
      {step === 3 && (
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Review before recording</p>
          <dl className={styles.review}>
            <div>
              <dt>Student</dt>
              <dd>
                {student?.name} · {student?.admissionNo}
              </dd>
            </div>
            <div>
              <dt>Programme</dt>
              <dd>{student?.program ?? "—"}</dd>
            </div>
            <div>
              <dt>Semester</dt>
              <dd>
                {selected?.label} ({selected?.number})
              </dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{money(amountValue)}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{method}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{reference || "—"}</dd>
            </div>
            <div>
              <dt>Balance now</dt>
              <dd>{money(selected?.outstanding ?? 0)}</dd>
            </div>
            <div>
              <dt>Balance after</dt>
              <dd>{money(afterBalance ?? 0)}</dd>
            </div>
          </dl>
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className={styles.confirm} disabled={submitting} onClick={() => void submit()}>
              {submitting ? <Loader2Icon aria-hidden className={styles.spin} /> : <CheckIcon aria-hidden />}
              Confirm and record
            </button>
          </div>
        </div>
      )}

      {/* Step 5 — done */}
      {(step === 4 || receiptNo) && (
        <div className={styles.stepBody}>
          <p className={styles.doneTitle}>Payment recorded</p>
          <dl className={styles.review}>
            <div>
              <dt>Student</dt>
              <dd>{student?.name}</dd>
            </div>
            <div>
              <dt>Semester</dt>
              <dd>{selected?.label}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{money(amountValue)}</dd>
            </div>
            <div>
              <dt>Receipt number</dt>
              <dd>{receiptNo}</dd>
            </div>
            {applied.map((row) => (
              <div key={row.invoice}>
                <dt>{row.invoice}</dt>
                <dd>{money(row.amount)}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.buttons}>
            <a className={styles.primary} href={`/dashboard/accounts/receipt/${encodeURIComponent(receiptNo ?? "")}`}>
              View receipt
            </a>
            <a
              className={styles.secondary}
              href={`/dashboard/accounts/receipt/${encodeURIComponent(receiptNo ?? "")}?download=1`}
            >
              Download
            </a>
            <button type="button" className={styles.secondary} onClick={reset}>
              Record another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
