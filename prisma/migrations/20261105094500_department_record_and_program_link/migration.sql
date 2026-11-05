-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- Backfill: one department per distinct spelling already typed onto a programme
ALTER TABLE "programs" ADD COLUMN "departmentId" TEXT;

INSERT INTO "departments" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."department", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "department" FROM "programs" WHERE "department" IS NOT NULL) AS p;

UPDATE "programs" AS pr
SET "departmentId" = d."id"
FROM "departments" AS d
WHERE d."name" = pr."department";

-- RequiredColumn
ALTER TABLE "programs" ALTER COLUMN "departmentId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "programs_departmentId_idx" ON "programs"("departmentId");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "programs" DROP COLUMN "department";
