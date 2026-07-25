-- Services are selectable as pickup or self drop-off by default. Services that
-- were explicitly self drop-off remain self drop-off only.
CREATE TYPE "ServiceFulfillmentMode" AS ENUM ('BOTH', 'SELF_DROP_OFF');

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" DROP DEFAULT;

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" TYPE "ServiceFulfillmentMode"
USING (
  CASE
    WHEN "fulfillmentType"::text = 'SELF_DROP_OFF'
      THEN 'SELF_DROP_OFF'::"ServiceFulfillmentMode"
    ELSE 'BOTH'::"ServiceFulfillmentMode"
  END
);

ALTER TABLE "Service"
ALTER COLUMN "fulfillmentType" SET DEFAULT 'BOTH';

-- Each garage independently declares which customer handover modes it accepts.
CREATE TYPE "GarageFulfillmentMode" AS ENUM (
  'BOTH',
  'PICKUP_DELIVERY',
  'SELF_DROP_OFF'
);

ALTER TABLE "Garage"
ADD COLUMN "fulfillmentMode" "GarageFulfillmentMode" NOT NULL DEFAULT 'BOTH';

CREATE INDEX "Garage_fulfillmentMode_idx" ON "Garage"("fulfillmentMode");
