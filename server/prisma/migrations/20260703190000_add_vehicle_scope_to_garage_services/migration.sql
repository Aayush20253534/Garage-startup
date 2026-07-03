ALTER TABLE "GarageService"
ADD COLUMN "vehicleBrand" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN "vehicleModel" TEXT NOT NULL DEFAULT 'ALL';

DROP INDEX IF EXISTS "GarageService_garageId_serviceId_key";

CREATE UNIQUE INDEX "GarageService_garageId_serviceId_vehicleBrand_vehicleModel_key"
ON "GarageService"("garageId", "serviceId", "vehicleBrand", "vehicleModel");

CREATE INDEX "GarageService_vehicleBrand_idx" ON "GarageService"("vehicleBrand");
CREATE INDEX "GarageService_vehicleModel_idx" ON "GarageService"("vehicleModel");
