-- Programs that share a name are the SAME programme entered twice: the row holding the
-- most students is the keeper; every twin's references move onto it, the twin is renamed
-- and archived (its history stays readable), and a programme's name becomes unique — so
-- the office can never bill students on a row their fee plan is not attached to.

CREATE TEMP TABLE _dupes AS
SELECT name,
       (ARRAY_AGG(id ORDER BY
          (SELECT count(*) FROM enrollments e WHERE e."programId" = programs.id) DESC,
          "createdAt" ASC))[1] AS keeper_id
FROM programs
GROUP BY name
HAVING count(*) > 1;

CREATE TEMP TABLE _twins AS
SELECT p.id AS twin_id, d.keeper_id, p.name
FROM programs p
JOIN _dupes d ON d.name = p.name
WHERE p.id <> d.keeper_id;

-- Move every programme-scoped reference onto the keeper.
-- A twin's plan that would collide with the keeper's same version is deactivated: the
-- keeper's own version is the one the students are billed on.
UPDATE program_fee_plans   SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id
  AND NOT EXISTS (SELECT 1 FROM program_fee_plans x WHERE x."programId" = keeper_id AND x.version = program_fee_plans.version);
UPDATE program_fee_plans   SET "isActive" = false WHERE "programId" IN (SELECT twin_id FROM _twins) AND "isActive";
UPDATE enrollments         SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE applications        SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE academic_classes    SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE exams               SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE timetable_slots     SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE id_cards            SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE offer_letters       SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE fee_items           SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE invoices            SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE program_units       SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE program_modules     SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;
UPDATE attachment_requirements SET "programId" = keeper_id FROM _twins t WHERE "programId" = t.twin_id;

-- Rename and archive the twins: the name is freed for a future real programme, and the
-- row stays readable for anything that already points at it.
UPDATE programs p
SET "name" = p.name || ' (archived ' || to_char(now(), 'YYYY-MM-DD') || ')',
    "archivedAt" = now(),
    "archivedReason" = 'Duplicate of ' || (SELECT name FROM programs k WHERE k.id = (SELECT keeper_id FROM _twins t WHERE t.twin_id = p.id))
WHERE p.id IN (SELECT twin_id FROM _twins);

-- A programme's name is unique among live programmes.
CREATE UNIQUE INDEX "programs_name_key" ON "programs"("name");
