CREATE TYPE "PriceRangeSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "price_range_submissions" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "vehicleBrand" TEXT,
    "vehicleModel" TEXT,
    "fuelType" "FuelType",
    "minPrice" INTEGER NOT NULL,
    "maxPrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "PriceRangeSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "approvedPriceRangeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_range_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_range_submissions_status_createdAt_idx"
ON "price_range_submissions"("status", "createdAt");

CREATE INDEX "price_range_submissions_submittedById_createdAt_idx"
ON "price_range_submissions"("submittedById", "createdAt");

CREATE INDEX "price_range_submissions_reviewedById_idx"
ON "price_range_submissions"("reviewedById");

CREATE INDEX "price_range_submissions_serviceId_idx"
ON "price_range_submissions"("serviceId");

CREATE INDEX "price_range_submissions_city_idx"
ON "price_range_submissions"("city");

CREATE INDEX "price_range_submissions_approvedPriceRangeId_idx"
ON "price_range_submissions"("approvedPriceRangeId");

ALTER TABLE "price_range_submissions"
ADD CONSTRAINT "price_range_submissions_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_range_submissions"
ADD CONSTRAINT "price_range_submissions_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "staff_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "price_range_submissions"
ADD CONSTRAINT "price_range_submissions_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "staff_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "price_range_submissions"
ADD CONSTRAINT "price_range_submissions_approvedPriceRangeId_fkey"
FOREIGN KEY ("approvedPriceRangeId") REFERENCES "CityServicePriceRange"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
