-- Separate service completion, return delivery, customer payment submission,
-- and garage confirmation so pickup bookings keep tracking until handover.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingTrackingPhase') THEN
    CREATE TYPE "BookingTrackingPhase" AS ENUM (
      'PICKUP_TO_CUSTOMER',
      'RETURN_TO_GARAGE',
      'DELIVERY_TO_CUSTOMER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingFinalPaymentMethod') THEN
    CREATE TYPE "BookingFinalPaymentMethod" AS ENUM ('CASH', 'UPI');
  END IF;
END $$;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "arrivedAtGarageAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "serviceCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveryStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalPaymentMethod" "BookingFinalPaymentMethod",
  ADD COLUMN IF NOT EXISTS "finalPaymentAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "finalPaymentSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalPaymentConfirmedAt" TIMESTAMP(3);

ALTER TABLE "booking_tracking_points"
  ADD COLUMN IF NOT EXISTS "journeyPhase" "BookingTrackingPhase" NOT NULL DEFAULT 'PICKUP_TO_CUSTOMER';

CREATE INDEX IF NOT EXISTS "booking_tracking_points_bookingId_journeyPhase_recordedAt_idx"
  ON "booking_tracking_points"("bookingId", "journeyPhase", "recordedAt");
