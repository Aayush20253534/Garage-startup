-- Service catalogue entries no longer own a global price.
-- Live pricing is resolved through CityServicePriceRange, while BookingService
-- retains estimated/final price snapshots for historical booking accuracy.
ALTER TABLE "Service"
  DROP COLUMN IF EXISTS "basePrice",
  DROP COLUMN IF EXISTS "minPrice",
  DROP COLUMN IF EXISTS "maxPrice";
