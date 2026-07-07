-- Add Google Maps place metadata to saved locations and garages.
ALTER TABLE "CustomerLocation"
  ADD COLUMN "formattedAddress" TEXT,
  ADD COLUMN "placeId" TEXT,
  ADD COLUMN "addressComponents" JSONB;

ALTER TABLE "Garage"
  ADD COLUMN "placeId" TEXT;

ALTER TABLE "GarageApplication"
  ADD COLUMN "placeId" TEXT;

-- Persist route summaries and the latest live garage location on bookings.
ALTER TABLE "Booking"
  ADD COLUMN "customerPlaceId" TEXT,
  ADD COLUMN "routeDistanceMeters" INTEGER,
  ADD COLUMN "routeDurationSeconds" INTEGER,
  ADD COLUMN "routePolyline" TEXT,
  ADD COLUMN "routeUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "trackingStartedAt" TIMESTAMP(3),
  ADD COLUMN "trackingEndedAt" TIMESTAMP(3),
  ADD COLUMN "lastGarageLatitude" DOUBLE PRECISION,
  ADD COLUMN "lastGarageLongitude" DOUBLE PRECISION,
  ADD COLUMN "lastGarageHeading" DOUBLE PRECISION,
  ADD COLUMN "lastGarageSpeedKph" DOUBLE PRECISION,
  ADD COLUMN "lastGarageAccuracyM" DOUBLE PRECISION,
  ADD COLUMN "lastGarageLocationAt" TIMESTAMP(3);

CREATE TYPE "TrackingSource" AS ENUM ('GARAGE', 'CUSTOMER', 'ADMIN');

CREATE TABLE "booking_tracking_points" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "garageId" TEXT,
  "userId" TEXT,
  "source" "TrackingSource" NOT NULL DEFAULT 'GARAGE',
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "snappedLatitude" DOUBLE PRECISION,
  "snappedLongitude" DOUBLE PRECISION,
  "roadPlaceId" TEXT,
  "heading" DOUBLE PRECISION,
  "speedKph" DOUBLE PRECISION,
  "accuracyM" DOUBLE PRECISION,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_tracking_points_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_tracking_points_bookingId_recordedAt_idx"
  ON "booking_tracking_points"("bookingId", "recordedAt");
CREATE INDEX "booking_tracking_points_garageId_recordedAt_idx"
  ON "booking_tracking_points"("garageId", "recordedAt");
CREATE INDEX "booking_tracking_points_userId_recordedAt_idx"
  ON "booking_tracking_points"("userId", "recordedAt");

ALTER TABLE "booking_tracking_points"
  ADD CONSTRAINT "booking_tracking_points_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_tracking_points"
  ADD CONSTRAINT "booking_tracking_points_garageId_fkey"
  FOREIGN KEY ("garageId") REFERENCES "Garage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_tracking_points"
  ADD CONSTRAINT "booking_tracking_points_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
