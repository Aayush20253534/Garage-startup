CREATE TYPE "GarageOperationalStatus" AS ENUM (
  'ACTIVE',
  'TEMPORARILY_SUSPENDED',
  'PERMANENTLY_BLOCKED',
  'UNDER_REVIEW',
  'DOCUMENTS_EXPIRED'
);

CREATE TYPE "BookingEscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "PriceScheduleStatus" AS ENUM ('PENDING', 'APPLIED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "AvailabilityRuleEffect" AS ENUM ('ALLOW', 'DENY');

ALTER TABLE "Garage"
  ADD COLUMN "operationalStatus" "GarageOperationalStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedUntil" TIMESTAMP(3);

UPDATE "Garage"
SET "operationalStatus" = CASE
  WHEN "isActive" = true THEN 'ACTIVE'::"GarageOperationalStatus"
  ELSE 'PERMANENTLY_BLOCKED'::"GarageOperationalStatus"
END;

CREATE TABLE "admin_audit_logs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_escalation_rules" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "thresholdMinutes" INTEGER NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_escalation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_escalations" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" "BookingEscalationStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "booking_escalations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "price_range_schedules" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "vehicleBrand" TEXT,
  "vehicleModel" TEXT,
  "fuelType" "FuelType",
  "minPrice" INTEGER NOT NULL,
  "maxPrice" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "status" "PriceScheduleStatus" NOT NULL DEFAULT 'PENDING',
  "previousRange" JSONB,
  "appliedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_range_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_availability_rules" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "cityId" TEXT,
  "garageId" TEXT,
  "vehicleBrand" TEXT,
  "vehicleModel" TEXT,
  "fuelType" "FuelType",
  "dayOfWeek" INTEGER,
  "startTime" TEXT,
  "endTime" TEXT,
  "effect" "AvailabilityRuleEffect" NOT NULL DEFAULT 'DENY',
  "reason" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_availability_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Garage_operationalStatus_city_idx" ON "Garage"("operationalStatus", "city");
CREATE INDEX "Garage_operationalStatus_suspendedUntil_idx" ON "Garage"("operationalStatus", "suspendedUntil");
CREATE UNIQUE INDEX "admin_escalation_rules_key_key" ON "admin_escalation_rules"("key");
CREATE UNIQUE INDEX "booking_escalations_bookingId_ruleKey_key" ON "booking_escalations"("bookingId", "ruleKey");
CREATE INDEX "admin_audit_logs_actorId_createdAt_idx" ON "admin_audit_logs"("actorId", "createdAt");
CREATE INDEX "admin_audit_logs_resource_createdAt_idx" ON "admin_audit_logs"("resource", "createdAt");
CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON "admin_audit_logs"("action", "createdAt");
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");
CREATE INDEX "admin_escalation_rules_enabled_idx" ON "admin_escalation_rules"("enabled");
CREATE INDEX "booking_escalations_status_severity_lastDetectedAt_idx" ON "booking_escalations"("status", "severity", "lastDetectedAt");
CREATE INDEX "booking_escalations_bookingId_idx" ON "booking_escalations"("bookingId");
CREATE INDEX "price_range_schedules_status_startsAt_idx" ON "price_range_schedules"("status", "startsAt");
CREATE INDEX "price_range_schedules_status_endsAt_idx" ON "price_range_schedules"("status", "endsAt");
CREATE INDEX "price_range_schedules_serviceId_city_idx" ON "price_range_schedules"("serviceId", "city");
CREATE INDEX "price_range_schedules_scopeKey_idx" ON "price_range_schedules"("scopeKey");
CREATE INDEX "service_availability_rules_serviceId_isActive_idx" ON "service_availability_rules"("serviceId", "isActive");
CREATE INDEX "service_availability_rules_cityId_isActive_idx" ON "service_availability_rules"("cityId", "isActive");
CREATE INDEX "service_availability_rules_garageId_isActive_idx" ON "service_availability_rules"("garageId", "isActive");

ALTER TABLE "booking_escalations"
  ADD CONSTRAINT "booking_escalations_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_range_schedules"
  ADD CONSTRAINT "price_range_schedules_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_availability_rules"
  ADD CONSTRAINT "service_availability_rules_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_availability_rules"
  ADD CONSTRAINT "service_availability_rules_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_availability_rules"
  ADD CONSTRAINT "service_availability_rules_garageId_fkey"
  FOREIGN KEY ("garageId") REFERENCES "Garage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "admin_escalation_rules"
  ("id", "key", "label", "description", "enabled", "thresholdMinutes", "severity", "updatedAt")
VALUES
  ('d51e7df6-ae1b-4d4d-8afe-f27dc40c0001', 'NO_GARAGE_ACCEPTED', 'No garage accepted', 'Booking is still searching for a garage.', true, 20, 'HIGH', CURRENT_TIMESTAMP),
  ('d51e7df6-ae1b-4d4d-8afe-f27dc40c0002', 'ASSIGNED_NOT_STARTED', 'Assigned booking not started', 'Garage was assigned but service has not started.', true, 120, 'MEDIUM', CURRENT_TIMESTAMP),
  ('d51e7df6-ae1b-4d4d-8afe-f27dc40c0003', 'SERVICE_RUNNING_LONG', 'Service running too long', 'Booking remains in progress beyond the threshold.', true, 480, 'HIGH', CURRENT_TIMESTAMP),
  ('d51e7df6-ae1b-4d4d-8afe-f27dc40c0004', 'PAYMENT_STUCK', 'Payment needs attention', 'Payment or paid booking has not advanced.', true, 30, 'HIGH', CURRENT_TIMESTAMP),
  ('d51e7df6-ae1b-4d4d-8afe-f27dc40c0005', 'SCHEDULE_OVERDUE', 'Scheduled booking overdue', 'Scheduled time has passed without completion.', true, 60, 'MEDIUM', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
