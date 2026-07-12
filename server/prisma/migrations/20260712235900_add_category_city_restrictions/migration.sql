CREATE TABLE "service_category_city_restrictions" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_category_city_restrictions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_category_city_restrictions_categoryId_cityId_key"
ON "service_category_city_restrictions"("categoryId", "cityId");

CREATE INDEX "service_category_city_restrictions_categoryId_idx"
ON "service_category_city_restrictions"("categoryId");

CREATE INDEX "service_category_city_restrictions_cityId_idx"
ON "service_category_city_restrictions"("cityId");

ALTER TABLE "service_category_city_restrictions"
ADD CONSTRAINT "service_category_city_restrictions_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_category_city_restrictions"
ADD CONSTRAINT "service_category_city_restrictions_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
