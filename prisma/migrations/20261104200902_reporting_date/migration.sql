-- CreateTable
CREATE TABLE "reporting_dates" (
    "id" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reporting_dates_campusId_date_idx" ON "reporting_dates"("campusId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_dates_campusId_year_month_key" ON "reporting_dates"("campusId", "year", "month");

-- AddForeignKey
ALTER TABLE "reporting_dates" ADD CONSTRAINT "reporting_dates_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
