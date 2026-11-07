-- Programmes gain a versioned fee structure and students gain the bills it generates.
--
-- Nothing here is a parallel ledger: a payable period becomes an ordinary invoice with one
-- line, and money is still recorded as an ordinary payment against that invoice. The new
-- columns only say which plan version and which period produced the bill, which is what
-- makes enrolment idempotent and what keeps an old student's agreed fee frozen when the
-- programme's fees are later repriced.

BEGIN;

-- How a cadence splits the fee. Existing rows keep CUSTOM until they are named below.
CREATE TYPE "FeePeriodKind" AS ENUM ('MONTHLY', 'SEMESTER', 'TERM', 'ACADEMIC_YEAR', 'ONE_TIME', 'CUSTOM');

ALTER TABLE "fee_cadences" ADD COLUMN "kind" "FeePeriodKind" NOT NULL DEFAULT 'CUSTOM';

-- The three cadences the seed already created are recognised; anything else stays CUSTOM
-- and is configured period by period.
UPDATE "fee_cadences" SET "kind" = 'MONTHLY'
    WHERE lower("name") IN ('monthly', 'per month');
UPDATE "fee_cadences" SET "kind" = 'SEMESTER'
    WHERE lower("name") IN ('per semester', 'semester');
UPDATE "fee_cadences" SET "kind" = 'TERM'
    WHERE lower("name") IN ('per term', 'term');
UPDATE "fee_cadences" SET "kind" = 'ACADEMIC_YEAR'
    WHERE lower("name") IN ('per academic year', 'per year', 'academic year');
UPDATE "fee_cadences" SET "kind" = 'ONE_TIME'
    WHERE lower("name") IN ('one-time payment', 'one time payment', 'one-time');

-- The payment methods the feature names, added only where the college has not registered
-- an equivalent row already.
INSERT INTO "fee_cadences" ("id", "name", "kind", "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), 'Per term', 'TERM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Per academic year', 'ACADEMIC_YEAR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'One-time payment', 'ONE_TIME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Custom schedule', 'CUSTOM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

CREATE TABLE "program_fee_plans" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "cadenceId" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "program_fee_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_fee_plans_programId_version_key" ON "program_fee_plans"("programId", "version");
CREATE INDEX "program_fee_plans_programId_isActive_idx" ON "program_fee_plans"("programId", "isActive");

-- A plain unique constraint cannot express "one active plan per programme", because the
-- boolean is not part of the identity. The partial index can, and it is what stops two
-- active versions existing at once.
CREATE UNIQUE INDEX "program_fee_plans_one_active_idx" ON "program_fee_plans"("programId") WHERE "isActive";

ALTER TABLE "program_fee_plans" ADD CONSTRAINT "program_fee_plans_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_fee_plans" ADD CONSTRAINT "program_fee_plans_cadenceId_fkey"
    FOREIGN KEY ("cadenceId") REFERENCES "fee_cadences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A period row. Older rows keep planId null and behave exactly as before.
ALTER TABLE "fee_items" ADD COLUMN "planId" TEXT;
ALTER TABLE "fee_items" ADD COLUMN "sequence" INTEGER;
ALTER TABLE "fee_items" ADD COLUMN "yearIndex" INTEGER;
ALTER TABLE "fee_items" ADD COLUMN "semesterNo" INTEGER;
ALTER TABLE "fee_items" ADD COLUMN "dueOffsetDays" INTEGER;

CREATE UNIQUE INDEX "fee_items_planId_sequence_key" ON "fee_items"("planId", "sequence");
CREATE INDEX "fee_items_planId_idx" ON "fee_items"("planId");

ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "program_fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An invoice can now be a generated fee obligation.
ALTER TABLE "invoices" ADD COLUMN "enrollmentId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "feePlanId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "feePeriodId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "periodYear" INTEGER;
ALTER TABLE "invoices" ADD COLUMN "periodSemester" INTEGER;

-- The guard against duplicate obligations: a retried enrolment cannot bill a period twice.
CREATE UNIQUE INDEX "invoices_enrollmentId_feePeriodId_key" ON "invoices"("enrollmentId", "feePeriodId");
CREATE INDEX "invoices_feePlanId_idx" ON "invoices"("feePlanId");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_feePlanId_fkey"
    FOREIGN KEY ("feePlanId") REFERENCES "program_fee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_feePeriodId_fkey"
    FOREIGN KEY ("feePeriodId") REFERENCES "fee_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One receipt, split across the periods it settled.
ALTER TABLE "payments" ADD COLUMN "receiptNo" TEXT;
CREATE INDEX "payments_receiptNo_idx" ON "payments"("receiptNo");

COMMIT;
