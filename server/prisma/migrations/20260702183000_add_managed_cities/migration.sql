CREATE TABLE IF NOT EXISTS "City" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "state" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "City_normalizedName_key" ON "City"("normalizedName");
CREATE INDEX IF NOT EXISTS "City_isActive_idx" ON "City"("isActive");
CREATE INDEX IF NOT EXISTS "City_name_idx" ON "City"("name");

INSERT INTO "City" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT 'city_' || md5(LOWER(city_name)), city_name, LOWER(city_name), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM("city") AS city_name FROM "Garage" WHERE "city" IS NOT NULL AND TRIM("city") <> ''
  UNION
  SELECT DISTINCT TRIM("city") AS city_name FROM "GarageApplication" WHERE "city" IS NOT NULL AND TRIM("city") <> ''
  UNION
  SELECT DISTINCT TRIM("city") AS city_name FROM "CityServicePriceRange" WHERE "city" IS NOT NULL AND TRIM("city") <> ''
) existing_cities
WHERE NOT EXISTS (
  SELECT 1 FROM "City" c WHERE c."normalizedName" = LOWER(existing_cities.city_name)
);
