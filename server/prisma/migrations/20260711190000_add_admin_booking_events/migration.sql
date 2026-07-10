CREATE TABLE "admin_booking_events" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_booking_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_booking_events_bookingId_createdAt_idx"
ON "admin_booking_events"("bookingId", "createdAt");

CREATE INDEX "admin_booking_events_staffId_createdAt_idx"
ON "admin_booking_events"("staffId", "createdAt");

ALTER TABLE "admin_booking_events"
ADD CONSTRAINT "admin_booking_events_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
