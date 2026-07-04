-- Change defaults for future Booking records
ALTER TABLE "Booking"
ALTER COLUMN "handlingFee" SET DEFAULT 1,
ALTER COLUMN "payableAmount" SET DEFAULT 1;

-- Update existing records that still use the old placeholder value
UPDATE "Booking"
SET "handlingFee" = 1
WHERE "handlingFee" = 99;

UPDATE "Booking"
SET "payableAmount" = 1
WHERE "payableAmount" = 99;