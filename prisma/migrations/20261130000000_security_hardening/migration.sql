-- Security hardening: official letters require office review and verified contact.
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "contactVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contactVerificationMethod" TEXT;

ALTER TABLE "offer_letters"
  ADD COLUMN IF NOT EXISTS "downloadTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "downloadTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "offer_letters_downloadTokenHash_key"
  ON "offer_letters" ("downloadTokenHash")
  WHERE "downloadTokenHash" IS NOT NULL;

-- Every legacy letter was minted by the public form without office review or issuer identity.
UPDATE "offer_letters"
SET "revokedAt" = COALESCE("revokedAt", now()),
    "revokeReason" = COALESCE("revokeReason", 'Office review and contact verification required')
WHERE "issuedById" IS NULL;

-- Staff self-registration was public. Pending staff rows are untrusted and cannot be approved.
UPDATE "users"
SET "status" = 'DISABLED'
WHERE "role" IN ('TUTOR', 'CAMPUS_ADMIN', 'SUPERADMIN')
  AND "status" = 'PENDING';

DELETE FROM "sessions"
WHERE "userId" IN (SELECT "id" FROM "users" WHERE "status" <> 'ACTIVE');
DELETE FROM "push_subscriptions"
WHERE "userId" IN (SELECT "id" FROM "users" WHERE "status" <> 'ACTIVE');
