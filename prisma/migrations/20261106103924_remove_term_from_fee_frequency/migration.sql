-- The college bills per semester, per module or per month; "Per term" is not a cadence it uses.
-- Postgres cannot drop a single enum value, so the type is rebuilt under the same name
-- and the column recast. The text cast aborts the transaction if any row still holds TERM,
-- so this either converts cleanly or leaves everything untouched.
BEGIN;

ALTER TYPE "FeeFrequency" RENAME TO "FeeFrequencyOld";

CREATE TYPE "FeeFrequency" AS ENUM ('SEMESTER', 'MODULE', 'MONTH');

ALTER TABLE "programs"
  ALTER COLUMN "feeFrequency" TYPE "FeeFrequency"
  USING "feeFrequency"::text::"FeeFrequency";

DROP TYPE "FeeFrequencyOld";

COMMIT;
