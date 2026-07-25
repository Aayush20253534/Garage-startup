-- Unify service configuration and booking snapshots under one enum that can
-- safely decode legacy BOTH rows. New bookings still store a concrete choice.
--
-- Some deployments received the database migration that wrote BOTH before the
-- generated Prisma Client knew that value. That made every query containing a
-- Service (and any nested query containing one) fail during result decoding.

-- Remember how invalid BOTH booking rows should be repaired before changing
-- either enum type. Text columns keep this temporary table independent of the
-- currently installed enum definition.
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

CREATE TYPE "ServiceFulfillmentType_v2" AS ENUM (
  'BOTH',
  'PICKUP_DELIVERY',
  'SELF_DROP_OFF'
);

ALTER TABLE "Booking"
ALTER COLUMN "fulfillmentType" DROP DEFAULT;

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" DROP DEFAULT;

ALTER TABLE "Booking"
ALTER COLUMN "fulfillmentType" TYPE "ServiceFulfillmentType_v2"
USING (
  CASE
    WHEN "fulfillmentType"::text = 'SELF_DROP_OFF' THEN 'SELF_DROP_OFF'
    ELSE 'PICKUP_DELIVERY'
  END
)::"ServiceFulfillmentType_v2";

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" TYPE "ServiceFulfillmentType_v2"
USING (
  CASE
    WHEN "fulfillmentType"::text = 'SELF_DROP_OFF' THEN 'SELF_DROP_OFF'
    ELSE 'BOTH'
  END
)::"ServiceFulfillmentType_v2";

DROP TYPE IF EXISTS "ServiceFulfillmentMode";
DROP TYPE IF EXISTS "ServiceFulfillmentType";
ALTER TYPE "ServiceFulfillmentType_v2" RENAME TO "ServiceFulfillmentType";

ALTER TABLE "Booking"
ALTER COLUMN "fulfillmentType" SET DEFAULT 'PICKUP_DELIVERY';

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" SET DEFAULT 'BOTH';

UPDATE "Booking" AS booking
SET "fulfillmentType" = repair."resolvedType"::"ServiceFulfillmentType"
FROM "_BookingFulfillmentRepair" AS repair
WHERE booking."id" = repair."bookingId";
