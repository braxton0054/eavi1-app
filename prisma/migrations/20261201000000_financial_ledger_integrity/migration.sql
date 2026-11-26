-- Financial ledger integrity: real receipts, exact corrections, immutable posted money.

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CREDIT';
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'REVERSED', 'REFUNDED');
CREATE TYPE "ReceiptKind" AS ENUM ('RECEIPT', 'CREDIT_NOTE');
CREATE TYPE "PaymentEntryType" AS ENUM ('PAYMENT', 'REVERSAL', 'REFUND');
CREATE TYPE "InvoiceLineKind" AS ENUM ('CHARGE', 'CREDIT_NOTE', 'VOID', 'VOID_REVERSAL');

CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq";
CREATE SEQUENCE IF NOT EXISTS "admission_number_seq";
CREATE SEQUENCE IF NOT EXISTS "receipt_number_seq";
CREATE SEQUENCE IF NOT EXISTS "credit_note_number_seq";

SELECT setval('invoice_number_seq', COALESCE(MAX(
  CASE WHEN "number" ~ '/[0-9]+$' THEN regexp_replace("number", '^.*/', '')::bigint ELSE 0 END
), 0) + 1, false) FROM "invoices";
SELECT setval('admission_number_seq', COALESCE(MAX(
  CASE WHEN "admissionNo" ~ '/[0-9]+$' THEN regexp_replace("admissionNo", '^.*/', '')::bigint ELSE 0 END
), 0) + 1, false) FROM "student_profiles";
SELECT setval('receipt_number_seq', COALESCE(MAX(sequence), 0) + 1, false) FROM (
  SELECT regexp_replace("receiptNo", '^.*[^0-9]', '')::bigint AS sequence
  FROM "payments"
  WHERE "receiptNo" ~ '[0-9]+$'
  UNION ALL
  SELECT regexp_replace("scopeKey", '^.*[^0-9]', '')::bigint AS sequence
  FROM "generated_documents"
  WHERE "kind" = 'RECEIPT' AND "scopeKey" ~ '[0-9]+$'
) AS receipt_numbers;
SELECT setval('credit_note_number_seq', 1, false);

-- Refuse ambiguous legacy identities instead of merging students or silently choosing a
-- canonical M-Pesa transaction. The deployment preflight reports these rows for review.
DO $$
DECLARE collisions integer;
BEGIN
  SELECT COUNT(*) INTO collisions FROM (
    SELECT upper(p."receiptNo")
    FROM "payments" p JOIN "invoices" i ON i."id" = p."invoiceId"
    WHERE p."receiptNo" IS NOT NULL
    GROUP BY upper(p."receiptNo")
    HAVING COUNT(DISTINCT (p."studentId", i."campusId", p."method", p."reference", p."paidAt")) > 1
  ) AS ambiguous;
  IF collisions > 0 THEN
    RAISE EXCEPTION 'Financial migration paused: % receipt number(s) have conflicting legacy metadata. Reconcile receipt identities before deploying.', collisions;
  END IF;

  SELECT COUNT(*) INTO collisions FROM (
    SELECT upper(regexp_replace(p."reference", '[^A-Z0-9]', '', 'g'))
    FROM "payments" p
    WHERE p."method" = 'MPESA' AND p."reference" IS NOT NULL
      AND NULLIF(upper(regexp_replace(p."reference", '[^A-Z0-9]', '', 'g')), '') IS NOT NULL
    GROUP BY upper(regexp_replace(p."reference", '[^A-Z0-9]', '', 'g'))
    HAVING COUNT(DISTINCT p."receiptNo") > 1
       OR COUNT(*) FILTER (WHERE p."receiptNo" IS NULL) > 1
  ) AS duplicates;
  IF collisions > 0 THEN
    RAISE EXCEPTION 'Financial migration paused: % normalized M-Pesa reference(s) occur on multiple legacy receipts. Verify cash evidence before deploying.', collisions;
  END IF;
END $$;

ALTER TABLE "invoices"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "voidedFromStatus" "InvoiceStatus";

ALTER TABLE "invoice_lines"
  ADD COLUMN "kind" "InvoiceLineKind" NOT NULL DEFAULT 'CHARGE',
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "createdByEmail" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3);
UPDATE "invoice_lines" line
SET "createdAt" = invoice."createdAt"
FROM "invoices" invoice
WHERE invoice."id" = line."invoiceId" AND line."createdAt" IS NULL;
ALTER TABLE "invoice_lines" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "invoice_lines" ALTER COLUMN "createdAt" SET NOT NULL;
CREATE UNIQUE INDEX "invoice_lines_idempotencyKey_key" ON "invoice_lines"("idempotencyKey");

CREATE TABLE "receipts" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "numberNormalized" TEXT NOT NULL,
  "kind" "ReceiptKind" NOT NULL DEFAULT 'RECEIPT',
  "studentId" TEXT NOT NULL,
  "campusId" INTEGER NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "method" "PaymentMethod",
  "reference" TEXT,
  "providerReferenceNormalized" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
  "idempotencyKey" TEXT,
  "requestHash" TEXT,
  "legacyPaymentId" TEXT,
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "reversedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "reason" TEXT,
  "sourceInvoiceId" TEXT,
  "allocationSnapshot" JSONB,
  "totalFees" DECIMAL(18,2),
  "paidToDate" DECIMAL(18,2),
  "balance" DECIMAL(18,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receipts_number_key" UNIQUE ("number"),
  CONSTRAINT "receipts_numberNormalized_key" UNIQUE ("numberNormalized"),
  CONSTRAINT "receipts_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "receipts_legacyPaymentId_key" UNIQUE ("legacyPaymentId"),
  CONSTRAINT "receipts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "receipts_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "receipts_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "receipts_amount_ck" CHECK (
    ("kind" = 'RECEIPT' AND "amount" > 0) OR
    ("kind" = 'CREDIT_NOTE' AND "amount" < 0)
  )
);
CREATE INDEX "receipts_studentId_paidAt_idx" ON "receipts"("studentId", "paidAt");
CREATE INDEX "receipts_campusId_paidAt_idx" ON "receipts"("campusId", "paidAt");

ALTER TABLE "payments"
  ADD COLUMN "receiptId" TEXT,
  ADD COLUMN "entryType" "PaymentEntryType" NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN "reversesPaymentId" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "createdByEmail" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve existing split receipts exactly when their metadata agrees.
WITH grouped AS (
  SELECT
    p."receiptNo" AS number,
    upper(p."receiptNo") AS normalized,
    p."studentId",
    i."campusId",
    SUM(p."amount") AS amount,
    p."method",
    p."reference",
    p."paidAt"
  FROM "payments" p
  JOIN "invoices" i ON i."id" = p."invoiceId"
  WHERE p."receiptNo" IS NOT NULL
  GROUP BY p."receiptNo", p."studentId", i."campusId", p."method", p."reference", p."paidAt"
)
INSERT INTO "receipts" (
  "id", "number", "numberNormalized", "studentId", "campusId", "amount", "method", "reference", "paidAt"
)
SELECT
  gen_random_uuid()::text, number, normalized, "studentId", "campusId", amount, method, reference, "paidAt"
FROM grouped;

-- Every legacy payment without a receipt becomes its own immutable receipt header.
WITH numbered AS (
  SELECT
    p."id" AS payment_id,
    p."studentId",
    i."campusId",
    p."amount",
    p."method",
    p."reference",
    p."paidAt",
    nextval('receipt_number_seq') AS sequence_no
  FROM "payments" p
  JOIN "invoices" i ON i."id" = p."invoiceId"
  WHERE p."receiptNo" IS NULL
)
INSERT INTO "receipts" (
  "id", "number", "numberNormalized", "studentId", "campusId", "amount", "method", "reference", "paidAt", "legacyPaymentId"
)
SELECT
  gen_random_uuid()::text,
  'RCP/' || to_char(now(), 'YYYY') || '/' ||
    CASE WHEN sequence_no < 1000 THEN lpad(sequence_no::text, 4, '0') ELSE sequence_no::text END,
  upper('RCP/' || to_char(now(), 'YYYY') || '/' ||
    CASE WHEN sequence_no < 1000 THEN lpad(sequence_no::text, 4, '0') ELSE sequence_no::text END),
  "studentId", "campusId", amount, method, reference, "paidAt", payment_id
FROM numbered;

UPDATE "payments" p
SET "receiptId" = r."id", "receiptNo" = r."number"
FROM "receipts" r
WHERE p."receiptNo" IS NOT NULL
  AND r."numberNormalized" = upper(p."receiptNo")
  AND r."studentId" = p."studentId";

UPDATE "payments" p
SET "receiptId" = r."id", "receiptNo" = r."number"
FROM "receipts" r
WHERE p."receiptNo" IS NULL AND r."legacyPaymentId" = p."id";

-- Legacy documents have no historical snapshot; preserve the reconciled current position.
-- Correlated sums include receipt-only students and default missing active-ledger totals to zero.
UPDATE "receipts" r
SET "totalFees" = COALESCE((
      SELECT SUM(l."amount")
      FROM "invoice_lines" l JOIN "invoices" i ON i."id" = l."invoiceId"
      WHERE i."studentId" = r."studentId" AND i."campusId" = r."campusId" AND i."status" <> 'VOID'
    ), 0),
    "paidToDate" = COALESCE((
      SELECT SUM(p."amount")
      FROM "payments" p JOIN "invoices" i ON i."id" = p."invoiceId"
      WHERE i."studentId" = r."studentId" AND i."campusId" = r."campusId" AND i."status" <> 'VOID'
    ), 0),
    "balance" = COALESCE((
      SELECT SUM(l."amount")
      FROM "invoice_lines" l JOIN "invoices" i ON i."id" = l."invoiceId"
      WHERE i."studentId" = r."studentId" AND i."campusId" = r."campusId" AND i."status" <> 'VOID'
    ), 0) - COALESCE((
      SELECT SUM(p."amount")
      FROM "payments" p JOIN "invoices" i ON i."id" = p."invoiceId"
      WHERE i."studentId" = r."studentId" AND i."campusId" = r."campusId" AND i."status" <> 'VOID'
    ), 0);

-- The former void action only flipped status. Reconcile unpaid legacy VOID bills with an
-- explicit contra; paid legacy VOID bills stop deployment for cash-evidence review rather
-- than inventing a reversal.
INSERT INTO "invoice_lines" ("id", "invoiceId", "label", "amount", "kind", "reason", "createdAt")
SELECT gen_random_uuid()::text, i."id", 'Legacy void reconciliation', -SUM(l."amount"), 'VOID',
       'Legacy void reconciliation during financial integrity migration', CURRENT_TIMESTAMP
FROM "invoices" i JOIN "invoice_lines" l ON l."invoiceId" = i."id"
WHERE i."status" = 'VOID' AND NOT EXISTS (
  SELECT 1 FROM "payments" p WHERE p."invoiceId" = i."id" AND p."amount" <> 0
)
GROUP BY i."id"
HAVING SUM(l."amount") <> 0;

DO $$
DECLARE paid_voids integer;
BEGIN
  SELECT COUNT(*) INTO paid_voids
  FROM "invoices" i
  WHERE i."status" = 'VOID' AND EXISTS (
    SELECT 1 FROM "payments" p WHERE p."invoiceId" = i."id" AND p."amount" <> 0
  );
  IF paid_voids > 0 THEN
    RAISE EXCEPTION 'Financial migration paused: % VOID invoice(s) still have money attached. Reconcile with verified reversal/refund evidence before deploying.', paid_voids;
  END IF;
END $$;

ALTER TABLE "receipts"
  ALTER COLUMN "totalFees" SET NOT NULL,
  ALTER COLUMN "paidToDate" SET NOT NULL,
  ALTER COLUMN "balance" SET NOT NULL;

ALTER TABLE "payments" ALTER COLUMN "receiptId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "receiptNo" SET NOT NULL;
CREATE INDEX "payments_receiptId_idx" ON "payments"("receiptId");
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_reversesPaymentId_fkey" FOREIGN KEY ("reversesPaymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "receipts"
SET "providerReferenceNormalized" = NULLIF(upper(regexp_replace("reference", '[^A-Z0-9]', '', 'g')), '')
WHERE "method" = 'MPESA' AND "reference" IS NOT NULL;
CREATE UNIQUE INDEX "receipts_providerReferenceNormalized_key"
  ON "receipts" ("providerReferenceNormalized");

-- Posted money is never removed by deleting an invoice or student.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_invoiceId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_studentId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_studentId_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" DROP CONSTRAINT IF EXISTS "invoice_lines_invoiceId_fkey";
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_entry_amount_ck" CHECK (
  ("entryType" = 'PAYMENT' AND "amount" > 0) OR
  ("entryType" IN ('REVERSAL', 'REFUND') AND "amount" < 0)
);
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_kind_amount_ck" CHECK (
  ("kind" = 'CHARGE' AND "amount" >= 0) OR
  ("kind" = 'CREDIT_NOTE' AND "amount" <= 0) OR
  ("kind" IN ('VOID', 'VOID_REVERSAL') AND "amount" <> 0)
);

-- Invoice documents now understand credit/void presentation. Original receipt documents
-- are deliberately not invalidated: their issuance snapshots remain immutable.
UPDATE "generated_documents" SET "status" = 'STALE' WHERE "kind" = 'INVOICE';
