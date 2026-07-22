ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GARAGE_CONTROLLER';

CREATE TYPE "GarageControllerAvailability" AS ENUM ('AVAILABLE', 'BUSY');

ALTER TABLE "Garage"
ADD COLUMN "controllerLimit" INTEGER NOT NULL DEFAULT 3;

CREATE TABLE "garage_controllers" (
  "id" TEXT NOT NULL,
  "garageId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'GARAGE_CONTROLLER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "availability" "GarageControllerAvailability" NOT NULL DEFAULT 'AVAILABLE',
  "passwordChangedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "lastActiveAt" TIMESTAMP(3),
  "createdByType" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_controllers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_controllers_email_key" ON "garage_controllers"("email");
CREATE UNIQUE INDEX "garage_controllers_phone_key" ON "garage_controllers"("phone");
CREATE INDEX "garage_controllers_garageId_deletedAt_isActive_availability_idx"
ON "garage_controllers"("garageId", "deletedAt", "isActive", "availability");
CREATE INDEX "garage_controllers_garageId_lastActiveAt_idx"
ON "garage_controllers"("garageId", "lastActiveAt");

CREATE TABLE "garage_controller_sessions" (
  "id" TEXT NOT NULL,
  "garageControllerId" TEXT NOT NULL,
  "userAgent" TEXT,
  "deviceId" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_controller_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "garage_controller_sessions_garageControllerId_expiresAt_idx"
ON "garage_controller_sessions"("garageControllerId", "expiresAt");
CREATE INDEX "garage_controller_sessions_garageControllerId_deviceId_idx"
ON "garage_controller_sessions"("garageControllerId", "deviceId");
CREATE INDEX "garage_controller_sessions_lastSeenAt_idx" ON "garage_controller_sessions"("lastSeenAt");
CREATE INDEX "garage_controller_sessions_expiresAt_idx" ON "garage_controller_sessions"("expiresAt");
CREATE INDEX "garage_controller_sessions_revokedAt_idx" ON "garage_controller_sessions"("revokedAt");

CREATE TABLE "garage_controller_otps" (
  "id" TEXT NOT NULL,
  "garageControllerId" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL DEFAULT 'RESET_PASSWORD',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "garage_controller_otps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_controller_otps_garageControllerId_purpose_key"
ON "garage_controller_otps"("garageControllerId", "purpose");
CREATE INDEX "garage_controller_otps_garageControllerId_idx"
ON "garage_controller_otps"("garageControllerId");

ALTER TABLE "Booking" ADD COLUMN "garageControllerId" TEXT;
CREATE INDEX "Booking_garageControllerId_status_idx" ON "Booking"("garageControllerId", "status");

ALTER TABLE "Notification" ADD COLUMN "garageControllerId" TEXT;
CREATE INDEX "Notification_garageControllerId_idx" ON "Notification"("garageControllerId");

ALTER TABLE "booking_tracking_points" ADD COLUMN "garageControllerId" TEXT;
CREATE INDEX "booking_tracking_points_garageControllerId_recordedAt_idx"
ON "booking_tracking_points"("garageControllerId", "recordedAt");

CREATE TABLE "garage_controller_dispatches" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "garageControllerId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "garage_controller_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_controller_dispatches_requestId_garageControllerId_channel_key"
ON "garage_controller_dispatches"("requestId", "garageControllerId", "channel");
CREATE INDEX "garage_controller_dispatches_garageControllerId_sentAt_idx"
ON "garage_controller_dispatches"("garageControllerId", "sentAt");
CREATE INDEX "garage_controller_dispatches_requestId_status_idx"
ON "garage_controller_dispatches"("requestId", "status");

ALTER TABLE "garage_controllers"
ADD CONSTRAINT "garage_controllers_garageId_fkey"
FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_controller_sessions"
ADD CONSTRAINT "garage_controller_sessions_garageControllerId_fkey"
FOREIGN KEY ("garageControllerId") REFERENCES "garage_controllers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_controller_otps"
ADD CONSTRAINT "garage_controller_otps_garageControllerId_fkey"
FOREIGN KEY ("garageControllerId") REFERENCES "garage_controllers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_garageControllerId_fkey"
FOREIGN KEY ("garageControllerId") REFERENCES "garage_controllers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_garageControllerId_fkey"
FOREIGN KEY ("garageControllerId") REFERENCES "garage_controllers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_tracking_points"
ADD CONSTRAINT "booking_tracking_points_garageControllerId_fkey"
FOREIGN KEY ("garageControllerId") REFERENCES "garage_controllers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "garage_controller_dispatches"
ADD CONSTRAINT "garage_controller_dispatches_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "GarageBroadcastRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "garage_controller_dispatches"
ADD CONSTRAINT "garage_controller_dispatches_garageControllerId_fkey"
FOREIGN KEY ("garageControllerId") REFERENCES "garage_controllers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
