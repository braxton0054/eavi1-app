-- A programme belongs to an accrediting body (KNEC, CDAC and the rest) and to a programme
-- type, and both lists are things the college edits in programme settings rather than
-- values fixed in the code. The hard-coded ProgramLevel enum and FeeFrequency enum move
-- into tables here; the names carried over are the ones the portal already displayed.
--
-- The three new programme columns are NOT NULL with no default, so this migration only
-- applies where no programme exists yet. That is true in production and in the local
-- development database. Any other environment must register a body, clear or assign its
-- programmes, and re-run.

BEGIN;

CREATE TABLE "program_bodies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "program_bodies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_bodies_name_key" ON "program_bodies"("name");
CREATE UNIQUE INDEX "program_bodies_code_key" ON "program_bodies"("code");

CREATE TABLE "program_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "program_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_types_name_key" ON "program_types"("name");
CREATE UNIQUE INDEX "program_types_code_key" ON "program_types"("code");

CREATE TABLE "fee_cadences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_cadences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fee_cadences_name_key" ON "fee_cadences"("name");

-- The five types the ProgramLevel enum offered.
INSERT INTO "program_types" ("id", "name", "code", "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), 'Certificate', 'CERT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Diploma', 'DIP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Higher diploma', 'HDIP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Degree', 'DEG', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Short course', 'SHORT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- The three cadences the FeeFrequency enum offered, in the words the form used.
INSERT INTO "fee_cadences" ("id", "name", "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), 'Per semester', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Per module', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Monthly', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "programs" ADD COLUMN "bodyId" TEXT NOT NULL;
ALTER TABLE "programs" ADD COLUMN "typeId" TEXT NOT NULL;
ALTER TABLE "programs" ADD COLUMN "cadenceId" TEXT NOT NULL;
ALTER TABLE "programs" DROP COLUMN "level";
ALTER TABLE "programs" DROP COLUMN "feeFrequency";

DROP TYPE "ProgramLevel";
DROP TYPE "FeeFrequency";

CREATE INDEX "programs_bodyId_fkey" ON "programs"("bodyId");
CREATE INDEX "programs_typeId_fkey" ON "programs"("typeId");
CREATE INDEX "programs_cadenceId_fkey" ON "programs"("cadenceId");

ALTER TABLE "programs" ADD CONSTRAINT "programs_bodyId_fkey"
    FOREIGN KEY ("bodyId") REFERENCES "program_bodies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "programs" ADD CONSTRAINT "programs_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "program_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "programs" ADD CONSTRAINT "programs_cadenceId_fkey"
    FOREIGN KEY ("cadenceId") REFERENCES "fee_cadences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
