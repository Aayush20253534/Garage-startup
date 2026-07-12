CREATE TABLE "service_city_restrictions" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_city_restrictions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_city_restrictions_serviceId_cityId_key"
ON "service_city_restrictions"("serviceId", "cityId");

CREATE INDEX "service_city_restrictions_serviceId_idx"
ON "service_city_restrictions"("serviceId");

CREATE INDEX "service_city_restrictions_cityId_idx"
ON "service_city_restrictions"("cityId");

ALTER TABLE "service_city_restrictions"
ADD CONSTRAINT "service_city_restrictions_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_city_restrictions"
ADD CONSTRAINT "service_city_restrictions_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
