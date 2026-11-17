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

-- Backfill: one department per distinct spelling already typed onto a programme.
-- Removed: the `department` text column it read from was never created — its migration was
-- superseded by this one twenty minutes after it was written. The office creates the
-- departments it needs in the app, then attaches programmes to them.
ALTER TABLE "programs" ADD COLUMN "departmentId" TEXT;

-- RequiredColumn
ALTER TABLE "programs" ALTER COLUMN "departmentId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "programs_departmentId_idx" ON "programs"("departmentId");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
