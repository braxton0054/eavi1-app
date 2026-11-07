-- Printable card designs become versioned data: a campus can change its card without a
-- deploy, and the college keeps one fallback template with campusId null. The artwork
-- lives in card-templates/ and the row only carries the svg text plus the asset urls.
--
-- Every card also gains the unguessable half of its QR verification link. The serial is
-- issued in sequence, so existing rows are backfilled with random tokens here and the
-- column is NOT NULL from this point on.

BEGIN;

CREATE TABLE "card_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campusId" INTEGER,
    "frontSvg" TEXT NOT NULL,
    "backSvg" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL DEFAULT '/card-logo.png',
    "signatureUrl" TEXT NOT NULL DEFAULT '/card-signature.png',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "card_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "card_templates_campusId_name_version_idx" ON "card_templates"("campusId", "name", "version");
CREATE INDEX "card_templates_campusId_isActive_idx" ON "card_templates"("campusId", "isActive");

ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_campusId_fkey"
    FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "id_cards" ADD COLUMN "verifyToken" TEXT;
UPDATE "id_cards" SET "verifyToken" = gen_random_uuid()::text WHERE "verifyToken" IS NULL;
ALTER TABLE "id_cards" ALTER COLUMN "verifyToken" SET NOT NULL;
CREATE UNIQUE INDEX "id_cards_verifyToken_key" ON "id_cards"("verifyToken");

ALTER TABLE "id_cards" ADD COLUMN "templateId" TEXT;
CREATE INDEX "id_cards_templateId_idx" ON "id_cards"("templateId");
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "card_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
