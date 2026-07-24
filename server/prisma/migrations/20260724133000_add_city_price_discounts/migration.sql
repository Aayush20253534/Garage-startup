CREATE TABLE "city_price_discounts" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_price_discounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "city_price_discounts_cityId_key" ON "city_price_discounts"("cityId");
CREATE INDEX "city_price_discounts_isActive_idx" ON "city_price_discounts"("isActive");
CREATE INDEX "city_price_discounts_createdById_idx" ON "city_price_discounts"("createdById");
CREATE INDEX "city_price_discounts_updatedById_idx" ON "city_price_discounts"("updatedById");

ALTER TABLE "city_price_discounts"
ADD CONSTRAINT "city_price_discounts_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "city_price_discounts"
ADD CONSTRAINT "city_price_discounts_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "city_price_discounts"
ADD CONSTRAINT "city_price_discounts_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "city_price_discounts"
ADD CONSTRAINT "city_price_discounts_percent_check"
CHECK ("discountPercent" >= 1 AND "discountPercent" <= 90);
