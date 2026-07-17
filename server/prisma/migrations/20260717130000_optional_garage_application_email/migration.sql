-- Garage applications are phone-first. Email is optional, while every garage
-- owner must retain a unique mobile login identifier.
ALTER TABLE "GarageApplication"
  ALTER COLUMN "email" DROP NOT NULL;

UPDATE "garage_owners" AS owner
SET "phone" = garage."phone"
FROM "Garage" AS garage
WHERE owner."phone" IS NULL
  AND garage."ownerId" = owner."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "garage_owners" WHERE "phone" IS NULL) THEN
    RAISE EXCEPTION 'Every garage owner needs a phone number before phone-first login can be enabled.';
  END IF;
END
$$;

ALTER TABLE "garage_owners"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "phone" SET NOT NULL;
