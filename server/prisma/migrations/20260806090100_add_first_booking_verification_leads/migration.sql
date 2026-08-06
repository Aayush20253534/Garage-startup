ALTER TABLE "User" ADD COLUMN "firstBookingOfferConsumedAt" TIMESTAMP(3);

CREATE TYPE "BookingVerificationLeadStatus" AS ENUM (
  'PENDING',
  'CLAIMED',
  'IN_CALL',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "booking_verification_leads" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "BookingVerificationLeadStatus" NOT NULL DEFAULT 'PENDING',
  "claimedById" TEXT,
  "claimedAt" TIMESTAMP(3),
  "callStartedAt" TIMESTAMP(3),
  "callEndedAt" TIMESTAMP(3),
  "callDurationSeconds" INTEGER,
  "verificationNotes" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "escalationAttemptedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "booking_verification_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_verification_leads_bookingId_key"
  ON "booking_verification_leads"("bookingId");
CREATE UNIQUE INDEX "booking_verification_leads_userId_key"
  ON "booking_verification_leads"("userId");
CREATE INDEX "booking_verification_leads_status_claimedById_createdAt_idx"
  ON "booking_verification_leads"("status", "claimedById", "createdAt");
CREATE INDEX "booking_verification_leads_escalatedAt_escalationAttemptedAt_createdAt_idx"
  ON "booking_verification_leads"("escalatedAt", "escalationAttemptedAt", "createdAt");

ALTER TABLE "booking_verification_leads"
  ADD CONSTRAINT "booking_verification_leads_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_verification_leads"
  ADD CONSTRAINT "booking_verification_leads_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_verification_leads"
  ADD CONSTRAINT "booking_verification_leads_claimedById_fkey"
  FOREIGN KEY ("claimedById") REFERENCES "customer_support_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Booking_one_active_per_vehicle_idx";
CREATE UNIQUE INDEX "Booking_one_active_per_vehicle_idx"
ON "Booking" ("vehicleId")
WHERE "status" IN (
  'PENDING_PAYMENT',
  'PENDING_VERIFICATION',
  'SEARCHING_GARAGE',
  'GARAGE_ASSIGNED',
  'CONFIRMED',
  'IN_PROGRESS'
);
