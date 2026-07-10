CREATE UNIQUE INDEX IF NOT EXISTS "Booking_one_active_per_vehicle_idx"
ON "Booking" ("vehicleId")
WHERE "status" IN (
  'PENDING_PAYMENT',
  'SEARCHING_GARAGE',
  'GARAGE_ASSIGNED',
  'CONFIRMED',
  'IN_PROGRESS'
);
