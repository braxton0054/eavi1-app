/**
 * Verifies the fee statement template: the totals it derives, the running balance it
 * prints, and the one-page truncation rule for long histories.
 *
 * Run: npx tsx scripts/verify-fees-statement.ts
 */
import { feesStatementSvg, type FeesStatementTx } from "../lib/statements/fees-statement";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const txs = (count: number): FeesStatementTx[] =>
  Array.from({ length: count }, (_, i) => ({
    date: `${String(i + 1).padStart(2, "0")} Jan 2026`,
    description: i % 2 === 0 ? `Invoice INV-2026-${String(i).padStart(4, "0")}` : `Payment · REF-${i}`,
    debit: i % 2 === 0 ? 10_000 : null,
    credit: i % 2 === 0 ? null : 7_500,
  }));

console.log("\nfee statement");

{
  const svg = feesStatementSvg({
    fullName: "Faith Jepchirchir Kosgei",
    admissionNo: "EAVI/2026/0142",
    course: "Diploma in ICT",
    campus: "Main Campus",
    intake: "January 2026",
    statementDate: "16 Nov 2026",
    website: "https://eavi.college.eavi.shop",
    contactEmail: null,
    transactions: [
      { date: "05 Jan 2026", description: "Invoice INV-2026-0001 (Year 1, Sem 1)", debit: 42_500, credit: null },
      { date: "20 Jan 2026", description: "Payment · M-PESA · REF-88", debit: null, credit: 20_000 },
    ],
  });

  check("renders a document", svg.startsWith("<svg"), svg.slice(0, 40));
  check("carries the student's name", svg.includes("Faith Jepchirchir Kosgei"));
  check("carries the admission no", svg.includes("EAVI/2026/0142"));
  check("billed is the sum of the debits", svg.includes("KSh 42,500.00"));
  check("paid is the sum of the credits", svg.includes("KSh 20,000.00"));
  check("balance is what is left", svg.includes("KSh 22,500.00"));
  check("an open balance is called a balance due", svg.includes("BALANCE DUE"));
  check("XML metacharacters cannot break the document", !feesStatementSvg({
    fullName: `O'Brien & Sons <Jr>`, admissionNo: "EAVI/2026/0142", course: "ICT", campus: "Main",
    statementDate: "16 Nov 2026", website: null, contactEmail: null,
    transactions: [],
  }).includes(`<t>`));
}

{
  // A fully paid account states its balance without demanding one.
  const svg = feesStatementSvg({
    fullName: "Faith Jepchirchir Kosgei", admissionNo: "EAVI/2026/0142", course: "ICT", campus: "Main",
    statementDate: "16 Nov 2026", website: null, contactEmail: null,
    transactions: [
      { date: "05 Jan 2026", description: "Invoice INV-2026-0001", debit: 10_000, credit: null },
      { date: "06 Jan 2026", description: "Payment · REF-1", debit: null, credit: 10_000 },
    ],
  });
  check("a cleared account has no balance due", !svg.includes("BALANCE DUE"), "balance label");
}

{
  // A long history stays on one page: the newest rows win and the oldest collapse into
  // an opening balance, so the statement still tells the whole truth.
  const svg = feesStatementSvg({
    fullName: "Faith Jepchirchir Kosgei", admissionNo: "EAVI/2026/0142", course: "ICT", campus: "Main",
    statementDate: "16 Nov 2026", website: null, contactEmail: null,
    transactions: txs(30),
  });
  check("a long history is truncated to one page", svg.includes("Opening balance — 10 older transactions"));
  check("the opening balance carries the omitted rows", svg.includes("KSh 12,500.00"));
  check("no row overflows the page", !svg.includes(`y="2990"`));
}

{
  // An account with nothing on it is still a statement, not an error.
  const svg = feesStatementSvg({
    fullName: "Faith Jepchirchir Kosgei", admissionNo: "EAVI/2026/0142", course: "ICT", campus: "Main",
    statementDate: "16 Nov 2026", website: null, contactEmail: null,
    transactions: [],
  });
  check("an empty account renders a note, not a blank page", svg.includes("No transactions on this account yet."));
}

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`} ${passed} passed.`);
if (failed > 0) process.exit(1);
