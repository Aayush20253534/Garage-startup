-- Add service-level fulfilment mode and snapshot it on each booking.
CREATE TYPE "ServiceFulfillmentType" AS ENUM ('PICKUP_DELIVERY', 'SELF_DROP_OFF');

ALTER TABLE "Service"
ADD COLUMN "fulfillmentType" "ServiceFulfillmentType" NOT NULL DEFAULT 'PICKUP_DELIVERY';

ALTER TABLE "Booking"
ADD COLUMN "fulfillmentType" "ServiceFulfillmentType" NOT NULL DEFAULT 'PICKUP_DELIVERY';

CREATE INDEX "Service_fulfillmentType_idx" ON "Service"("fulfillmentType");
CREATE INDEX "Booking_fulfillmentType_idx" ON "Booking"("fulfillmentType");
