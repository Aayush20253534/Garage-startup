-- Add the one-time customer journey used by self drop-off bookings.
ALTER TYPE "BookingTrackingPhase"
  ADD VALUE IF NOT EXISTS 'SELF_DROP_TO_GARAGE';
