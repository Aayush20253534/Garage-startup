-- Preserve the catalogue's previous alphabetical order as the initial
-- per-category display order, then let admins explicitly control it.
ALTER TABLE "Service"
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_services AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "categoryId"
      ORDER BY LOWER("name") ASC, "createdAt" ASC, "id" ASC
    ) AS position
  FROM "Service"
)
UPDATE "Service" AS service
SET "displayOrder" = ranked_services.position
FROM ranked_services
WHERE service."id" = ranked_services."id";

CREATE INDEX "Service_categoryId_displayOrder_idx"
ON "Service"("categoryId", "displayOrder");
