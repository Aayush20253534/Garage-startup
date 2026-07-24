ALTER TABLE "Service"
ADD COLUMN "isPopular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "popularOrder" INTEGER;

WITH ranked_services AS (
  SELECT
    service."id",
    ROW_NUMBER() OVER (
      ORDER BY category."name" ASC, service."name" ASC, service."id" ASC
    ) AS position
  FROM "Service" AS service
  INNER JOIN "ServiceCategory" AS category
    ON category."id" = service."categoryId"
  WHERE service."isActive" = true
    AND category."isActive" = true
)
UPDATE "Service" AS service
SET
  "isPopular" = true,
  "popularOrder" = ranked_services.position
FROM ranked_services
WHERE service."id" = ranked_services."id"
  AND ranked_services.position <= 6;

CREATE INDEX "Service_isPopular_popularOrder_idx"
ON "Service"("isPopular", "popularOrder");
