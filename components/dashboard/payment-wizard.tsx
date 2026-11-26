"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon, Loader2Icon, SearchIcon } from "lucide-react";

import { recordWizardPayment } from "@/lib/actions/college/accounts";
import { allocationFingerprint, planPaymentAllocation, type PlannedAllocation } from "@/lib/fees/allocation";
import { fromCents, parsePaymentAmount } from "@/lib/fees/money";
import { moneyExact } from "@/lib/format";
import { StatusChip } from "@/components/dashboard/status-chip";

import styles from "./payment-wizard.module.css";

/** The single payment flow: student, lead invoice, exact amount, shared preview, receipt. */
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
  outstandingCents: number;
  creditCents: number;
  status: string;
  settled: boolean;
  dueAt: string | null;
  createdAt: string;
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
  campusLocked: boolean;
};

const STEPS = ["Student", "Invoice", "Payment", "Review", "Done"] as const;
const exact = (cents: number) => moneyExact(fromCents(cents));

export function PaymentWizard({ students, campusLocked }: Props) {
  const [step, setStep] = useState(-1);
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [applied, setApplied] = useState<PlannedAllocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const allocationRequest = useRef(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students.filter((option) => option.label.toLowerCase().includes(q)).slice(0, 8);
  }, [students, query]);

  const fetchAllocations = useCallback(async (studentId: string) => {
    const response = await fetch(`/dashboard/accounts/allocations/${studentId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("This student could not be loaded on your campus.");
    return (await response.json()) as { student: StudentSummary; allocations: Allocation[] };
  }, []);

  const loadAllocations = useCallback(async (studentId: string) => {
    const request = ++allocationRequest.current;
    setLoadingAllocations(true);
    setError(null);
    try {
      const data = await fetchAllocations(studentId);
      if (request !== allocationRequest.current) return null;
      setStudent(data.student);
      setAllocations(data.allocations);
      return data;
    } catch (cause) {
      if (request !== allocationRequest.current) return null;
      setError(cause instanceof Error ? cause.message : "The allocations could not be loaded. Try again.");
      setAllocations(null);
      return null;
    } finally {
      if (request === allocationRequest.current) setLoadingAllocations(false);
    }
  }, [fetchAllocations]);

  const selected = allocations?.find((row) => row.invoiceId === allocation?.invoiceId) ?? null;
  const amountCents = useMemo(() => {
    try {
      return parsePaymentAmount(amount);
    } catch {
      return null;
    }
  }, [amount]);
  const amountValid = amountCents !== null;
  const totalOutstandingCents = allocations?.reduce((sum, row) => sum + row.outstandingCents, 0) ?? 0;
  const plan = useMemo(() => {
    if (!allocations || !selected || amountCents === null) return null;
    return planPaymentAllocation(
      allocations.map((row) => ({
        id: row.invoiceId,
        invoiceNumber: row.number,
        status: row.status,
        dueAt: row.dueAt,
        createdAt: row.createdAt,
        outstandingCents: row.outstandingCents,
      })),
      amountCents,
      { leadInvoiceId: selected.invoiceId },
    );
  }, [allocations, selected, amountCents]);
  const planValid = plan?.ok === true;
  const mpesaReferenceMissing = method === "MPESA" && !reference.trim();
  const paymentDetailsValid = amountValid && Boolean(method) && !mpesaReferenceMissing && Boolean(paidAt);

  const clearSubmissionKey = () => setSubmissionKey(null);

  const review = async () => {
    if (!student || !selected || !paymentDetailsValid || !planValid) return;
    setLoadingAllocations(true);
    setError(null);
    try {
      const data = await fetchAllocations(student.id);
      const refreshed = data.allocations.find((row) => row.invoiceId === selected.invoiceId) ?? null;
      if (!refreshed || refreshed.settled) {
        setAllocations(data.allocations);
        setAllocation(null);
        setError("That invoice changed while you were reviewing. Choose an outstanding invoice again.");
        setStep(1);
        return;
      }
      setStudent(data.student);
      setAllocations(data.allocations);
      setAllocation(refreshed);
      setSubmissionKey((current) => current ?? crypto.randomUUID());
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The allocations could not be refreshed. Try again.");
    } finally {
      setLoadingAllocations(false);
    }
  };

  const submit = async () => {
    if (submitting || !student || !selected || !planValid) return;
    setSubmitting(true);
    setError(null);
    const key = submissionKey ?? crypto.randomUUID();
    setSubmissionKey(key);
    try {
      const body = new FormData();
      body.set("studentId", student.id);
      body.set("invoiceId", selected.invoiceId);
      body.set("amount", amount);
      body.set("method", method);
      body.set("reference", reference);
      body.set("paidAt", paidAt);
      body.set("idempotencyKey", key);
      body.set("expectedAllocationFingerprint", allocationFingerprint(plan.allocations));
      const result = await recordWizardPayment(body);
      if (result.ok) {
        setReceiptNo(result.receiptNo);
        setApplied(result.applied);
        setStep(4);
      } else {
        setError(result.error);
        if (result.error.includes("changed after review")) {
          setStep(2);
          setSubmissionKey(null);
        }
      }
    } catch {
      setError("The payment could not be confirmed. Retry with the same details; a submitted payment will not be duplicated.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    allocationRequest.current += 1;
    setStep(-1);
    setStudent(null);
    setAllocations(null);
    setAllocation(null);
    setAmount("");
    setMethod("");
    setReference("");
    setReceiptNo(null);
    setApplied([]);
    setSubmissionKey(null);
    setError(null);
    setQuery("");
  };

  const rail = (
    <>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STEPS.length - 1}
        aria-valuenow={receiptNo ? STEPS.length - 1 : step}
        aria-label="Payment progress"
        className="mb-2 h-1.5 overflow-hidden rounded-full bg-eavi-muted"
      >
        <div
          className="h-full rounded-full bg-eavi-fill transition-[width] duration-300"
          style={{ width: `${((receiptNo ? STEPS.length - 1 : Math.max(0, step)) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
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
    </>
  );

  if (step === -1) {
    return (
      <div className={styles.root}>
        {campusLocked ? (
          <p className={styles.note}>Choose a campus from the College overview to record payments.</p>
        ) : (
          <>
            <p className={styles.note}>
              Find the student, choose the invoice this payment starts at, review the exact allocation, then record one receipt.
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
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}

      {step === 0 && (
        <div className={styles.stepBody}>
          {campusLocked ? (
            <p className={styles.note}>Choose a campus from the College overview to record payments.</p>
          ) : (
            <>
              <label className={styles.label} htmlFor="wizard-student-search">Find the student (name or admission number)</label>
              <div className={styles.searchRow}>
                <SearchIcon aria-hidden className={styles.searchIcon} />
                <input
                  id="wizard-student-search"
                  className={styles.searchInput}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
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
                      disabled={loadingAllocations}
                      onClick={() => void loadAllocations(option.value)}
                    >
                      {option.label}<ChevronRightIcon aria-hidden className={styles.chev} />
                    </button>
                  </li>
                ))}
                {filtered.length === 0 ? <li className={styles.empty}>No student matches.</li> : null}
              </ul>
              {loadingAllocations ? <p className={styles.loading}><Loader2Icon aria-hidden className={styles.spin} /> Loading their ledger…</p> : null}
              {student && allocations ? (
                <div className={styles.picked}>
                  <p className={styles.pickedName}>{student.name}</p>
                  <p className={styles.pickedMeta}>{student.admissionNo} · {student.program ?? "—"} · {student.intake ?? "—"}</p>
                  <p className={styles.pickedMeta}>
                    {totalOutstandingCents === 0
                      ? "No outstanding invoice on their ledger — nothing to record."
                      : `${exact(totalOutstandingCents)} outstanding across ${allocations.filter((row) => !row.settled).length} invoice(s).`}
                  </p>
                  <button type="button" className={styles.primary} disabled={totalOutstandingCents === 0} onClick={() => setStep(1)}>
                    Choose invoice
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>{student?.name} — choose the invoice this payment starts at</p>
          <ul className={styles.allocations}>
            {allocations?.map((row) => (
              <li key={row.invoiceId}>
                {row.settled ? (
                  <div className={styles.allocation} data-settled="true">
                    <span className={styles.allocLabel}>{row.label}<span className={styles.allocNumber}>{row.number}</span></span>
                    <span className={styles.allocOutstanding} data-done="true">
                      {row.creditCents > 0 ? `Credit ${exact(row.creditCents)}` : <StatusChip tone="success">Completed</StatusChip>}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.allocation}
                    aria-pressed={allocation?.invoiceId === row.invoiceId}
                    onClick={() => { setAllocation(row); clearSubmissionKey(); setError(null); }}
                  >
                    <span className={styles.allocLabel}>{row.label}<span className={styles.allocNumber}>{row.number}</span></span>
                    <span className={styles.allocOutstanding}>
                      {row.status === "PARTIAL" ? "Part paid · " : row.status === "CREDIT" ? "Credit due · " : "Unpaid · "}
                      {exact(row.outstandingCents)}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          {selected ? (
            <p className={styles.summaryLine}>
              {exact(selected.outstandingCents)} outstanding on {selected.label}. Any excess moves to the oldest remaining unpaid invoice.
            </p>
          ) : null}
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={() => setStep(0)}>Back</button>
            <button type="button" className={styles.primary} disabled={!selected} onClick={() => setStep(2)}>Continue</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Paying {selected?.label} — {exact(selected?.outstandingCents ?? 0)} outstanding on it</p>
          <label className={styles.label} htmlFor="wizard-amount">Amount received (KES)</label>
          <input
            id="wizard-amount"
            className={styles.input}
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]{1,2})?"
            placeholder="0.00"
            value={amount}
            onChange={(event) => { setAmount(event.target.value); clearSubmissionKey(); }}
            aria-describedby="wizard-amount-hint"
          />
          <p id="wizard-amount-hint" className={styles.note}>Use no more than two decimal places. Total outstanding: {exact(totalOutstandingCents)}.</p>
          {amountValid && amountCents > totalOutstandingCents ? (
            <p className={styles.error}>That is more than the {exact(totalOutstandingCents)} this student owes.</p>
          ) : null}
          <label className={styles.label} htmlFor="wizard-method">Method</label>
          <select id="wizard-method" className={styles.input} value={method} onChange={(event) => { setMethod(event.target.value); clearSubmissionKey(); }}>
            <option value="">—</option>
            <option value="MPESA">M-PESA</option>
            <option value="BANK">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
          </select>
          <label className={styles.label} htmlFor="wizard-ref">Transaction / reference number{method === "MPESA" ? " (required)" : ""}</label>
          <input
            id="wizard-ref"
            className={styles.input}
            value={reference}
            onChange={(event) => { setReference(event.target.value); clearSubmissionKey(); }}
            placeholder="e.g. the M-PESA code"
            aria-invalid={mpesaReferenceMissing || undefined}
          />
          {mpesaReferenceMissing ? <p className={styles.error}>Enter the M-Pesa transaction reference so duplicate payments can be blocked.</p> : null}
          <label className={styles.label} htmlFor="wizard-date">Payment date</label>
          <input id="wizard-date" className={styles.input} type="date" value={paidAt} onChange={(event) => { setPaidAt(event.target.value); clearSubmissionKey(); }} />
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={() => setStep(1)}>Back</button>
            <button
              type="button"
              className={styles.primary}
              aria-busy={loadingAllocations}
              disabled={!paymentDetailsValid || !planValid || loadingAllocations}
              onClick={() => void review()}
            >
              {loadingAllocations ? <Loader2Icon aria-hidden className={styles.spin} /> : null} Review payment
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Review before recording</p>
          <dl className={styles.review}>
            <div><dt>Student</dt><dd>{student?.name} · {student?.admissionNo}</dd></div>
            <div><dt>Programme</dt><dd>{student?.program ?? "—"}</dd></div>
            <div><dt>Starts with</dt><dd>{selected?.label} ({selected?.number})</dd></div>
            <div><dt>Amount</dt><dd>{exact(amountCents ?? 0)}</dd></div>
            <div><dt>Method</dt><dd>{method}</dd></div>
            <div><dt>Reference</dt><dd>{reference || "—"}</dd></div>
            <div><dt>Payment date</dt><dd>{paidAt}</dd></div>
            <div><dt>Debt before</dt><dd>{exact(totalOutstandingCents)}</dd></div>
            <div><dt>Debt after</dt><dd>{exact(Math.max(0, totalOutstandingCents - (amountCents ?? 0)))}</dd></div>
          </dl>
          {plan?.ok ? (
            <div>
              <p className={styles.stepTitle}>Allocation preview</p>
              <ul className={styles.allocations}>
                {plan.allocations.map((row) => (
                  <li key={row.invoiceId} className={styles.allocation} data-settled="true">
                    <span className={styles.allocLabel}>{row.invoiceNumber}<span className={styles.allocNumber}>Balance after: {exact(row.balanceAfterCents)}</span></span>
                    <span className={styles.allocOutstanding} data-done="true">{exact(row.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={styles.buttons}>
            <button type="button" className={styles.secondary} onClick={() => { setStep(2); clearSubmissionKey(); }}>Back</button>
            <button
              type="button"
              className={styles.confirm}
              aria-busy={submitting}
              disabled={submitting || !planValid}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2Icon aria-hidden className={styles.spin} /> : <CheckIcon aria-hidden />}
              {submitting ? "Recording…" : "Confirm and record"}
            </button>
          </div>
        </div>
      )}

      {(step === 4 || receiptNo) && (
        <div className={styles.stepBody}>
          <p className={styles.doneTitle}>Payment recorded</p>
          <dl className={styles.review}>
            <div><dt>Student</dt><dd>{student?.name}</dd></div>
            <div><dt>Amount</dt><dd>{exact(amountCents ?? 0)}</dd></div>
            <div><dt>Receipt number</dt><dd>{receiptNo}</dd></div>
            {applied.map((row) => (
              <div key={row.invoiceId}><dt>{row.invoiceNumber}</dt><dd>{exact(row.amountCents)} · balance {exact(row.balanceAfterCents)}</dd></div>
            ))}
          </dl>
          <div className={styles.buttons}>
            <a className={styles.primary} href={`/dashboard/accounts/receipt/${encodeURIComponent(receiptNo ?? "")}`}>View receipt</a>
            <a className={styles.secondary} href={`/dashboard/accounts/receipt/${encodeURIComponent(receiptNo ?? "")}?download=1`}>Download</a>
            <button type="button" className={styles.secondary} onClick={reset}>Record another</button>
          </div>
        </div>
      )}
    </div>
  );
}
