ALTER TABLE "Garage"
ADD COLUMN "excludedServiceBrands" JSONB NOT NULL DEFAULT '[]'::jsonb;
