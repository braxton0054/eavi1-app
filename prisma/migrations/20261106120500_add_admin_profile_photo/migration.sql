-- An administrator's own picture, shown next to their name at the top right of the portal.
-- Nullable, so every account that has never uploaded one keeps working unchanged.
ALTER TABLE "users" ADD COLUMN "photoUrl" TEXT;
