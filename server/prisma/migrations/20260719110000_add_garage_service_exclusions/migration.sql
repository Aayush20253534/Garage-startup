ALTER TABLE "GarageService"
ADD COLUMN "isExcluded" BOOLEAN NOT NULL DEFAULT false;

-- Convert temporary no-model scopes into explicit whole-brand exclusions.
DELETE FROM "GarageService" AS pending
USING "GarageService" AS existing
WHERE pending."id" <> existing."id"
  AND pending."garageId" = existing."garageId"
  AND pending."serviceId" = existing."serviceId"
  AND pending."vehicleBrand" = existing."vehicleBrand"
  AND UPPER(pending."vehicleModel") = 'NONE'
  AND UPPER(existing."vehicleModel") = 'ALL';

UPDATE "GarageService"
SET "vehicleModel" = 'ALL', "isExcluded" = true
WHERE UPPER("vehicleBrand") <> 'NONE'
  AND UPPER("vehicleModel") = 'NONE';

-- A no-brand placeholder has no brand to exclude and cannot be made useful.
DELETE FROM "GarageService"
WHERE UPPER("vehicleBrand") = 'NONE';

CREATE INDEX "GarageService_isExcluded_idx"
ON "GarageService"("isExcluded");
