-- CreateTable
CREATE TABLE "card_batches" (
    "id" TEXT NOT NULL,
    "campusId" INTEGER,
    "targetLabel" TEXT NOT NULL,
    "cardCount" INTEGER NOT NULL,
    "sheetCount" INTEGER NOT NULL,
    "fileUrl" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_batches_campusId_createdAt_idx" ON "card_batches"("campusId", "createdAt");

-- AddForeignKey
ALTER TABLE "card_batches" ADD CONSTRAINT "card_batches_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

