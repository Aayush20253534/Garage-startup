-- Recover and unify service configuration and booking snapshots under one enum.
--
-- IMPORTANT: Prisma Migrate does not wrap PostgreSQL migrations in a
-- transaction by default. This migration intentionally opts in so the enum
-- replacement is atomic and the temporary booking repair table survives until
-- the final data update.
--
-- The SQL is also safe to re-apply after a partially executed version of this
-- migration. It always converts both columns through a fresh v3 enum before
-- removing any legacy enum types.

BEGIN;

-- Preserve the concrete booking choice for any legacy booking that contains
-- BOTH. A booking becomes self drop-off when at least one selected service is
-- self-drop-off-only; otherwise it becomes pickup and delivery.
CREATE TEMP TABLE "_BookingFulfillmentRepair" ON COMMIT DROP AS
SELECT
  booking."id" AS "bookingId",
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM "BookingService" AS booking_service
      INNER JOIN "Service" AS service
        ON service."id" = booking_service."serviceId"
      WHERE booking_service."bookingId" = booking."id"
        AND service."fulfillmentType"::text = 'SELF_DROP_OFF'
    ) THEN 'SELF_DROP_OFF'
    ELSE 'PICKUP_DELIVERY'
  END AS "resolvedType"
FROM "Booking" AS booking
WHERE booking."fulfillmentType"::text = 'BOTH';

-- A prior failed, non-transactional attempt can leave the database in any of
-- these states:
--   * Service uses ServiceFulfillmentMode while Booking uses ServiceFulfillmentType
--   * one or both columns use ServiceFulfillmentType_v2
--   * both columns already use the desired ServiceFulfillmentType
-- Converting both columns through a new enum makes every state converge safely.
DROP TYPE IF EXISTS "ServiceFulfillmentType_v3";
CREATE TYPE "ServiceFulfillmentType_v3" AS ENUM (
  'BOTH',
  'PICKUP_DELIVERY',
  'SELF_DROP_OFF'
);

ALTER TABLE "Booking"
ALTER COLUMN "fulfillmentType" DROP DEFAULT;

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" DROP DEFAULT;

ALTER TABLE "Booking"
ALTER COLUMN "fulfillmentType" TYPE "ServiceFulfillmentType_v3"
USING (
  CASE
    WHEN "fulfillmentType"::text = 'SELF_DROP_OFF' THEN 'SELF_DROP_OFF'
    WHEN "fulfillmentType"::text = 'BOTH' THEN 'PICKUP_DELIVERY'
    ELSE 'PICKUP_DELIVERY'
  END
)::"ServiceFulfillmentType_v3";

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" TYPE "ServiceFulfillmentType_v3"
USING (
  CASE
    WHEN "fulfillmentType"::text = 'SELF_DROP_OFF' THEN 'SELF_DROP_OFF'
    ELSE 'BOTH'
  END
)::"ServiceFulfillmentType_v3";

-- Both columns now use v3, so all legacy enum types are dependency-free.
DROP TYPE IF EXISTS "ServiceFulfillmentMode";
DROP TYPE IF EXISTS "ServiceFulfillmentType_v2";
DROP TYPE IF EXISTS "ServiceFulfillmentType";
ALTER TYPE "ServiceFulfillmentType_v3" RENAME TO "ServiceFulfillmentType";

ALTER TABLE "Booking"
ALTER COLUMN "fulfillmentType" SET DEFAULT 'PICKUP_DELIVERY';

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" SET DEFAULT 'BOTH';

UPDATE "Booking" AS booking
SET "fulfillmentType" = repair."resolvedType"::"ServiceFulfillmentType"
FROM "_BookingFulfillmentRepair" AS repair
WHERE booking."id" = repair."bookingId";

COMMIT;
