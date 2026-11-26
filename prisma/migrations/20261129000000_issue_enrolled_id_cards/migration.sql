-- Digital card issuance belongs to enrolment, not to a physical print batch.
-- This forward repair is idempotent and safe to run after the original backfill:
--   * existing eligible PENDING/PRINTING cards become ISSUED;
--   * enrolled students with no card row receive an ISSUED card;
--   * LOST and REPLACED cards are never revived;
--   * serials are allocated above every serial already present for the current year.

LOCK TABLE "id_cards" IN SHARE ROW EXCLUSIVE MODE;

UPDATE "id_cards"
SET "issuedAt" = "createdAt"
WHERE "status" = 'ISSUED' AND "issuedAt" IS NULL;

WITH active AS (
  SELECT DISTINCT ON (e."studentId")
    e."studentId",
    sp."campusId",
    e."programId",
    e."enrolledAt",
    ap."startsAt",
    p."durationMonths"
  FROM "enrollments" e
  JOIN "student_profiles" sp ON sp."id" = e."studentId"
  JOIN "academic_periods" ap ON ap."id" = e."periodId"
  JOIN "programs" p ON p."id" = e."programId"
  WHERE e."status" = 'ACTIVE'
  ORDER BY e."studentId", e."enrolledAt" DESC, e."id" DESC
),
chosen AS (
  SELECT DISTINCT ON (ic."studentId")
    ic."id",
    ic."issuedAt",
    ic."createdAt",
    ic."expiresAt",
    a."programId",
    a."startsAt",
    a."durationMonths"
  FROM "id_cards" ic
  JOIN active a ON a."studentId" = ic."studentId"
  WHERE ic."status" IN ('PENDING', 'PRINTING')
    AND NOT EXISTS (
      SELECT 1 FROM "id_cards" live
      WHERE live."studentId" = ic."studentId"
        AND live."status" = 'ISSUED'
        AND live."id" <> ic."id"
    )
  ORDER BY ic."studentId", ic."createdAt" DESC, ic."id" DESC
)
UPDATE "id_cards" ic
SET
  "status" = 'ISSUED',
  "issuedAt" = COALESCE(chosen."issuedAt", chosen."createdAt"),
  "expiresAt" = COALESCE(
    chosen."expiresAt",
    CASE
      WHEN chosen."durationMonths" IS NULL OR chosen."durationMonths" <= 0 THEN NULL
      ELSE chosen."startsAt" + make_interval(months => chosen."durationMonths"::integer)
    END
  ),
  "programId" = COALESCE(ic."programId", chosen."programId")
FROM chosen
WHERE ic."id" = chosen."id";

WITH active AS (
  SELECT DISTINCT ON (e."studentId")
    e."studentId",
    sp."campusId",
    e."programId",
    e."enrolledAt",
    ap."startsAt",
    p."durationMonths"
  FROM "enrollments" e
  JOIN "student_profiles" sp ON sp."id" = e."studentId"
  JOIN "academic_periods" ap ON ap."id" = e."periodId"
  JOIN "programs" p ON p."id" = e."programId"
  WHERE e."status" = 'ACTIVE'
  ORDER BY e."studentId", e."enrolledAt" DESC, e."id" DESC
),
serial_base AS (
  SELECT COALESCE(
    MAX(
      CASE
        WHEN "serial" ~ ('^IDC/' || to_char(now(), 'YYYY') || '/[0-9]+$')
          THEN split_part("serial", '/', 3)::integer
      END
    ),
    0
  ) AS max_serial
  FROM "id_cards"
),
missing AS (
  SELECT
    a.*,
    row_number() OVER (ORDER BY a."studentId") AS row_number
  FROM active a
  WHERE NOT EXISTS (
    SELECT 1 FROM "id_cards" ic WHERE ic."studentId" = a."studentId"
  )
)
INSERT INTO "id_cards" (
  "id",
  "serial",
  "verifyToken",
  "studentId",
  "campusId",
  "programId",
  "status",
  "issuedAt",
  "expiresAt",
  "remarks",
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  'IDC/' || to_char(now(), 'YYYY') || '/' ||
    CASE
      WHEN serial_base.max_serial + missing.row_number < 10000
        THEN lpad((serial_base.max_serial + missing.row_number)::text, 4, '0')
      ELSE (serial_base.max_serial + missing.row_number)::text
    END,
  gen_random_uuid()::text,
  missing."studentId",
  missing."campusId",
  missing."programId",
  'ISSUED',
  COALESCE(missing."enrolledAt", missing."startsAt", now()),
  CASE
    WHEN missing."durationMonths" IS NULL OR missing."durationMonths" <= 0 THEN NULL
    ELSE missing."startsAt" + make_interval(months => missing."durationMonths"::integer)
  END,
  'Auto-issued on enrolment',
  now()
FROM missing
CROSS JOIN serial_base
ON CONFLICT ("serial") DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "id_cards_one_issued_per_student"
  ON "id_cards" ("studentId")
  WHERE "status" = 'ISSUED';
