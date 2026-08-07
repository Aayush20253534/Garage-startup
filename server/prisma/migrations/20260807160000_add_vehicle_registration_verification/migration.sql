ALTER TABLE "User"
ADD COLUMN "vehicleRegistrationRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Vehicle"
ADD COLUMN "registrationVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "registrationVerifiedAt" TIMESTAMP(3),
ADD COLUMN "registrationVerificationProvider" TEXT,
ADD COLUMN "rcOwnerNameMasked" TEXT,
ADD COLUMN "rcMaker" TEXT,
ADD COLUMN "rcModel" TEXT,
ADD COLUMN "rcFuelType" TEXT,
ADD COLUMN "rcVehicleClass" TEXT,
ADD COLUMN "rcStatus" TEXT;

CREATE INDEX "Vehicle_registrationNumber_idx" ON "Vehicle"("registrationNumber");
CREATE INDEX "Vehicle_registrationVerified_idx" ON "Vehicle"("registrationVerified");
