/*
  Warnings:

  - A unique constraint covering the columns `[campusId,year,termNo]` on the table `terms` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `campusId` to the `terms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termNo` to the `terms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `terms` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_termId_fkey";

-- DropIndex
DROP INDEX "terms_name_key";

-- AlterTable
ALTER TABLE "calendar_events" ALTER COLUMN "termId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "terms" ADD COLUMN     "campusId" INTEGER NOT NULL,
ADD COLUMN     "termNo" INTEGER NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "terms_campusId_startDate_idx" ON "terms"("campusId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "terms_campusId_year_termNo_key" ON "terms"("campusId", "year", "termNo");

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
