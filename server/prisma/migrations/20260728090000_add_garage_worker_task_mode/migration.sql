-- Add an admin-controlled switch between permanent controller accounts and
-- secure, booking-scoped WhatsApp worker task links.
ALTER TABLE "Garage"
ADD COLUMN "controllerAccountsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- The admin interface now intentionally exposes only two fulfilment modes.
-- Preserve every existing pickup-capable garage by converting the legacy
-- pickup-only value to pickup + self drop.
UPDATE "Garage"
SET "fulfillmentMode" = 'BOTH'
WHERE "fulfillmentMode"::text = 'PICKUP_DELIVERY';

CREATE TYPE "GarageWorkerTaskType" AS ENUM ('HANDOVER', 'DELIVERY');
CREATE TYPE "GarageWorkerTaskStatus" AS ENUM ('ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'REVOKED', 'EXPIRED');

CREATE TABLE "garage_worker_tasks" (
  "id" TEXT NOT NULL,
  "garageId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "taskType" "GarageWorkerTaskType" NOT NULL,
  "status" "GarageWorkerTaskStatus" NOT NULL DEFAULT 'ACTIVE',
  "workerName" TEXT NOT NULL,
  "workerPhone" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "openedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastLocationAt" TIMESTAMP(3),
  "createdByType" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_worker_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_worker_tasks_tokenHash_key"
ON "garage_worker_tasks"("tokenHash");

CREATE INDEX "garage_worker_tasks_garageId_status_expiresAt_idx"
ON "garage_worker_tasks"("garageId", "status", "expiresAt");

CREATE INDEX "garage_worker_tasks_bookingId_taskType_status_idx"
ON "garage_worker_tasks"("bookingId", "taskType", "status");

CREATE INDEX "garage_worker_tasks_requestId_idx"
ON "garage_worker_tasks"("requestId");

ALTER TABLE "garage_worker_tasks"
ADD CONSTRAINT "garage_worker_tasks_garageId_fkey"
FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_worker_tasks"
ADD CONSTRAINT "garage_worker_tasks_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_worker_tasks"
ADD CONSTRAINT "garage_worker_tasks_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "GarageBroadcastRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_tracking_points"
ADD COLUMN "workerTaskId" TEXT;

CREATE INDEX "booking_tracking_points_workerTaskId_recordedAt_idx"
ON "booking_tracking_points"("workerTaskId", "recordedAt");

ALTER TABLE "booking_tracking_points"
ADD CONSTRAINT "booking_tracking_points_workerTaskId_fkey"
FOREIGN KEY ("workerTaskId") REFERENCES "garage_worker_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
