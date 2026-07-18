ALTER TABLE "User"
  ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'PASSWORD',
  ADD COLUMN "firebaseUid" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

ALTER TABLE "pending_signups"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

-- Pending registrations predate explicit consent and must restart signup.
DELETE FROM "pending_signups";

ALTER TABLE "pending_signups"
  ALTER COLUMN "termsAcceptedAt" SET NOT NULL,
  ALTER COLUMN "privacyAcceptedAt" SET NOT NULL;

CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- Existing Google-created customers did not collect a phone number. Preserve
-- their ability to log in and bind their verified Firebase UID on next login.
UPDATE "User"
SET "authProvider" = 'GOOGLE'
WHERE "role" = 'CUSTOMER' AND "phone" IS NULL;
