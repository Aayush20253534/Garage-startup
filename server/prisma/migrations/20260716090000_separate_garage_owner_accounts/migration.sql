-- Canonicalize authentication emails and move garage-owner accounts out of
-- the customer User table while preserving all existing owner IDs.

CREATE FUNCTION rovauto_canonical_email(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN lower(split_part(trim(value), '@', 2)) IN ('gmail.com', 'googlemail.com')
      THEN regexp_replace(
        split_part(split_part(lower(trim(value)), '@', 1), '+', 1),
        '\.',
        '',
        'g'
      ) || '@gmail.com'
    ELSE lower(trim(value))
  END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    GROUP BY "role", rovauto_canonical_email("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize User emails: duplicate Gmail identities exist. Resolve them before deploying this migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "pending_signups"
    GROUP BY "role", rovauto_canonical_email("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize pending signup emails: duplicate Gmail identities exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "email_otps"
    GROUP BY rovauto_canonical_email("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize email OTP records: duplicate Gmail identities exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "staff_accounts"
    WHERE "email" IS NOT NULL
    GROUP BY rovauto_canonical_email("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize staff emails: duplicate Gmail identities exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "customer_support_accounts"
    GROUP BY rovauto_canonical_email("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize customer-support emails: duplicate Gmail identities exist.';
  END IF;
END
$$;

UPDATE "User" SET "email" = rovauto_canonical_email("email");
UPDATE "pending_signups" SET "email" = rovauto_canonical_email("email");
UPDATE "email_otps" SET "email" = rovauto_canonical_email("email");
UPDATE "staff_accounts"
SET "email" = rovauto_canonical_email("email")
WHERE "email" IS NOT NULL;
UPDATE "customer_support_accounts"
SET "email" = rovauto_canonical_email("email");
UPDATE "GarageApplication" SET "email" = rovauto_canonical_email("email");
UPDATE "Garage"
SET "email" = rovauto_canonical_email("email")
WHERE "email" IS NOT NULL;

CREATE TABLE "garage_owners" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "password" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'GARAGE_OWNER',
  "isEmailVerified" BOOLEAN NOT NULL DEFAULT true,
  "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
  "isOnboarded" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "passwordChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_owners_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "garage_owners_role_check" CHECK ("role" = 'GARAGE_OWNER')
);

CREATE UNIQUE INDEX "garage_owners_email_key" ON "garage_owners"("email");
CREATE UNIQUE INDEX "garage_owners_phone_key" ON "garage_owners"("phone");
CREATE INDEX "garage_owners_isActive_idx" ON "garage_owners"("isActive");

INSERT INTO "garage_owners" (
  "id", "name", "email", "phone", "password", "role",
  "isEmailVerified", "isPhoneVerified", "isOnboarded", "isActive",
  "passwordChangedAt", "createdAt", "updatedAt"
)
SELECT
  "id", "name", "email", "phone", "password", "role",
  "isEmailVerified", "isPhoneVerified", "isOnboarded", "isActive",
  "passwordChangedAt", "createdAt", "updatedAt"
FROM "User"
WHERE "role" = 'GARAGE_OWNER';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Garage" AS garage
    WHERE garage."ownerId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "garage_owners" AS owner
        WHERE owner."id" = garage."ownerId"
      )
  ) THEN
    RAISE EXCEPTION 'A garage references a non-garage User. Correct Garage.ownerId before deploying this migration.';
  END IF;
END
$$;

ALTER TABLE "Garage" DROP CONSTRAINT IF EXISTS "Garage_ownerId_fkey";
ALTER TABLE "Garage"
  ADD CONSTRAINT "Garage_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "garage_owners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "garage_owner_sessions" (
  "id" TEXT NOT NULL,
  "garageOwnerId" TEXT NOT NULL,
  "userAgent" TEXT,
  "deviceId" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_owner_sessions_pkey" PRIMARY KEY ("id")
);

INSERT INTO "garage_owner_sessions" (
  "id", "garageOwnerId", "userAgent", "deviceId", "lastSeenAt",
  "expiresAt", "revokedAt", "createdAt", "updatedAt"
)
SELECT
  session."id", session."userId", session."userAgent", session."deviceId",
  session."lastSeenAt", session."expiresAt", session."revokedAt",
  session."createdAt", session."updatedAt"
FROM "user_sessions" AS session
JOIN "garage_owners" AS owner ON owner."id" = session."userId";

CREATE INDEX "garage_owner_sessions_garageOwnerId_expiresAt_idx"
  ON "garage_owner_sessions"("garageOwnerId", "expiresAt");
CREATE INDEX "garage_owner_sessions_garageOwnerId_deviceId_idx"
  ON "garage_owner_sessions"("garageOwnerId", "deviceId");
CREATE INDEX "garage_owner_sessions_lastSeenAt_idx"
  ON "garage_owner_sessions"("lastSeenAt");
ALTER TABLE "garage_owner_sessions"
  ADD CONSTRAINT "garage_owner_sessions_garageOwnerId_fkey"
  FOREIGN KEY ("garageOwnerId") REFERENCES "garage_owners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "garage_owner_otps" (
  "id" TEXT NOT NULL,
  "garageOwnerId" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "garage_owner_otps_pkey" PRIMARY KEY ("id")
);

INSERT INTO "garage_owner_otps" (
  "id", "garageOwnerId", "otpHash", "purpose", "expiresAt", "usedAt",
  "attempts", "createdAt"
)
SELECT
  otp."id", otp."userId", otp."otpHash", otp."purpose", otp."expiresAt",
  otp."usedAt", otp."attempts", otp."createdAt"
FROM "Otp" AS otp
JOIN "garage_owners" AS owner ON owner."id" = otp."userId";

CREATE UNIQUE INDEX "garage_owner_otps_garageOwnerId_purpose_key"
  ON "garage_owner_otps"("garageOwnerId", "purpose");
CREATE INDEX "garage_owner_otps_garageOwnerId_idx"
  ON "garage_owner_otps"("garageOwnerId");
ALTER TABLE "garage_owner_otps"
  ADD CONSTRAINT "garage_owner_otps_garageOwnerId_fkey"
  FOREIGN KEY ("garageOwnerId") REFERENCES "garage_owners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD COLUMN "garageOwnerId" TEXT;
UPDATE "Notification" AS notification
SET "garageOwnerId" = notification."userId", "userId" = NULL
WHERE notification."userId" IN (SELECT "id" FROM "garage_owners");
CREATE INDEX "Notification_garageOwnerId_idx" ON "Notification"("garageOwnerId");
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_garageOwnerId_fkey"
  FOREIGN KEY ("garageOwnerId") REFERENCES "garage_owners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "garage_push_subscriptions" (
  "id" TEXT NOT NULL,
  "garageOwnerId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "deviceName" TEXT,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_push_subscriptions_pkey" PRIMARY KEY ("id")
);

INSERT INTO "garage_push_subscriptions" (
  "id", "garageOwnerId", "endpoint", "p256dh", "auth", "userAgent",
  "deviceName", "lastUsedAt", "createdAt", "updatedAt"
)
SELECT
  push."id", push."userId", push."endpoint", push."p256dh", push."auth",
  push."userAgent", push."deviceName", push."lastUsedAt", push."createdAt",
  push."updatedAt"
FROM "push_subscriptions" AS push
JOIN "garage_owners" AS owner ON owner."id" = push."userId";

CREATE UNIQUE INDEX "garage_push_subscriptions_endpoint_key"
  ON "garage_push_subscriptions"("endpoint");
CREATE INDEX "garage_push_subscriptions_garageOwnerId_idx"
  ON "garage_push_subscriptions"("garageOwnerId");
ALTER TABLE "garage_push_subscriptions"
  ADD CONSTRAINT "garage_push_subscriptions_garageOwnerId_fkey"
  FOREIGN KEY ("garageOwnerId") REFERENCES "garage_owners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_tracking_points" ADD COLUMN "garageOwnerId" TEXT;
UPDATE "booking_tracking_points" AS point
SET "garageOwnerId" = point."userId", "userId" = NULL
WHERE point."userId" IN (SELECT "id" FROM "garage_owners");
CREATE INDEX "booking_tracking_points_garageOwnerId_recordedAt_idx"
  ON "booking_tracking_points"("garageOwnerId", "recordedAt");
ALTER TABLE "booking_tracking_points"
  ADD CONSTRAINT "booking_tracking_points_garageOwnerId_fkey"
  FOREIGN KEY ("garageOwnerId") REFERENCES "garage_owners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DELETE FROM "push_subscriptions"
WHERE "userId" IN (SELECT "id" FROM "garage_owners");
DELETE FROM "user_sessions"
WHERE "userId" IN (SELECT "id" FROM "garage_owners");
DELETE FROM "Otp"
WHERE "userId" IN (SELECT "id" FROM "garage_owners");
DELETE FROM "User" WHERE "role" = 'GARAGE_OWNER';

ALTER TABLE "User"
  ADD CONSTRAINT "User_customer_role_check" CHECK ("role" = 'CUSTOMER');

DROP FUNCTION rovauto_canonical_email(TEXT);
