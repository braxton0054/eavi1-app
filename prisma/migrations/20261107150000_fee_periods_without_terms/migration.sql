-- Two corrections to the fee-period work.
--
-- 1. This college runs semesters; "term" was retired from the model and must not come back
--    through a payment type. Any row still carrying the TERM kind becomes a semester row.
-- 2. The four payment types the previous migration inserted were the college's decision to
--    make, not the migration's. They are removed where nothing has been billed on them, and
--    the programmes screen (with a billing-period choice) is where a new one is registered.

BEGIN;

-- Only unused rows are removed: a programme or a published plan pinning one keeps it.
DELETE FROM "fee_cadences" c
WHERE c."name" IN ('Per term', 'Per academic year', 'One-time payment', 'Custom schedule')
  AND NOT EXISTS (SELECT 1 FROM "programs" p WHERE p."cadenceId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "program_fee_plans" f WHERE f."cadenceId" = c."id");

UPDATE "fee_cadences" SET "kind" = 'SEMESTER' WHERE "kind" = 'TERM';

-- Postgres cannot drop a value from an enum in place, so the type is rebuilt without it.
ALTER TABLE "fee_cadences" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TYPE "FeePeriodKind" RENAME TO "FeePeriodKind_old";
CREATE TYPE "FeePeriodKind" AS ENUM ('MONTHLY', 'SEMESTER', 'ACADEMIC_YEAR', 'ONE_TIME', 'CUSTOM');
ALTER TABLE "fee_cadences"
    ALTER COLUMN "kind" TYPE "FeePeriodKind" USING "kind"::text::"FeePeriodKind";
ALTER TABLE "fee_cadences" ALTER COLUMN "kind" SET DEFAULT 'CUSTOM';
DROP TYPE "FeePeriodKind_old";

COMMIT;
