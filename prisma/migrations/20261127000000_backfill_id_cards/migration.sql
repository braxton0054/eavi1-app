-- Every enrolled student holds a card from enrolment onward. This backfills cards for
-- records created before that rule. One row per student, idempotent: a second run inserts
-- nothing. Serials follow the same IDC/year/sequence shape the application issues.
INSERT INTO "id_cards" ("id", "serial", "verifyToken", "studentId", "campusId", "programId", "status", "createdAt")
SELECT
  gen_random_uuid()::text,
  'IDC/' || date_part('year', now())::text || '/' || lpad(row_number() OVER (ORDER BY sp."id")::text, 4, '0'),
  gen_random_uuid()::text,
  sp."id",
  sp."campusId",
  e."programId",
  'PENDING',
  now()
FROM "student_profiles" sp
JOIN "enrollments" e ON e."studentId" = sp."id" AND e."status" = 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM "id_cards" ic WHERE ic."studentId" = sp."id")
ON CONFLICT ("serial") DO NOTHING;
