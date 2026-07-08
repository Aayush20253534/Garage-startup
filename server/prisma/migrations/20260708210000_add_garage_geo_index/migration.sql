-- Enable PostGIS for fast distance/radius queries on Neon PostgreSQL.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Keep the existing latitude/longitude columns, but add a GiST expression index
-- so ST_DWithin/ST_Distance queries can rank garages by the user's location.
CREATE INDEX IF NOT EXISTS "Garage_location_geography_gix"
ON "Garage"
USING GIST ((ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography))
WHERE "isActive" = true;

CREATE INDEX IF NOT EXISTS "Garage_city_active_verified_idx"
ON "Garage"("city", "isActive", "isVerified");
