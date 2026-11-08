-- CreateTable
CREATE TABLE "offer_letters" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "printedName" TEXT NOT NULL,
    "feeStructureUrl" TEXT,
    "bursaryFormUrl" TEXT,
    "requirements" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "issuedByEmail" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "offer_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_reference_key" ON "offer_letters"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_verifyToken_key" ON "offer_letters"("verifyToken");

-- CreateIndex
CREATE INDEX "offer_letters_campusId_issuedAt_idx" ON "offer_letters"("campusId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_applicationId_key" ON "offer_letters"("applicationId");

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

