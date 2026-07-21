-- Give each normalized live-pricing scope one stable database identity.
ALTER TABLE "CityServicePriceRange" ADD COLUMN "scopeKey" TEXT;

UPDATE "CityServicePriceRange"
SET "scopeKey" =
  octet_length(lower(btrim("city")))::text || ':' || lower(btrim("city")) || '|' ||
  octet_length("serviceId")::text || ':' || "serviceId" || '|' ||
  octet_length(lower(btrim(COALESCE("vehicleBrand", ''))))::text || ':' || lower(btrim(COALESCE("vehicleBrand", ''))) || '|' ||
  octet_length(lower(btrim(COALESCE("vehicleModel", ''))))::text || ':' || lower(btrim(COALESCE("vehicleModel", ''))) || '|' ||
  octet_length(lower(btrim(COALESCE("fuelType"::text, ''))))::text || ':' || lower(btrim(COALESCE("fuelType"::text, '')));

-- Preserve approval history while collapsing any legacy duplicate scopes.
WITH ranked AS (
  SELECT
    "id",
    first_value("id") OVER (
      PARTITION BY "scopeKey"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY "scopeKey"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "CityServicePriceRange"
)
UPDATE "price_range_submissions" AS submission
SET "approvedPriceRangeId" = ranked.keeper_id
FROM ranked
WHERE ranked.duplicate_rank > 1
  AND submission."approvedPriceRangeId" = ranked."id";

WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "scopeKey"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "CityServicePriceRange"
)
DELETE FROM "CityServicePriceRange" AS price_range
USING ranked
WHERE price_range."id" = ranked."id"
  AND ranked.duplicate_rank > 1;

ALTER TABLE "CityServicePriceRange"
  ALTER COLUMN "scopeKey" SET NOT NULL;

CREATE UNIQUE INDEX "CityServicePriceRange_scopeKey_key"
  ON "CityServicePriceRange"("scopeKey");

ALTER TABLE "CityServicePriceRange"
  ADD CONSTRAINT "CityServicePriceRange_valid_amounts_check"
  CHECK ("minPrice" >= 0 AND "maxPrice" >= "minPrice");
