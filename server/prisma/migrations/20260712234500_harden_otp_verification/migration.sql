-- Keep only the newest OTP per identity before adding uniqueness constraints.
DELETE FROM "email_otps" AS older
USING "email_otps" AS newer
WHERE older."email" = newer."email"
  AND (
    older."createdAt" < newer."createdAt"
    OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id")
  );

DELETE FROM "phone_otps" AS older
USING "phone_otps" AS newer
WHERE older."phone" = newer."phone"
  AND (
    older."createdAt" < newer."createdAt"
    OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id")
  );

DELETE FROM "Otp" AS older
USING "Otp" AS newer
WHERE older."userId" = newer."userId"
  AND older."purpose" = newer."purpose"
  AND (
    older."createdAt" < newer."createdAt"
    OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id")
  );

DROP INDEX IF EXISTS "email_otps_email_idx";
DROP INDEX IF EXISTS "phone_otps_phone_idx";

CREATE UNIQUE INDEX "email_otps_email_key" ON "email_otps"("email");
CREATE UNIQUE INDEX "phone_otps_phone_key" ON "phone_otps"("phone");
CREATE UNIQUE INDEX "Otp_userId_purpose_key" ON "Otp"("userId", "purpose");

ALTER TABLE "Booking"
  ADD COLUMN "handoverOtpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "handoverOtpClaimedAt" TIMESTAMP(3);
