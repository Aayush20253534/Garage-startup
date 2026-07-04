-- Restore production defaults after temporary testing fee changes.
ALTER TABLE "Booking"
ALTER COLUMN "handlingFee" SET DEFAULT 99,
ALTER COLUMN "payableAmount" SET DEFAULT 99;

UPDATE "Booking"
SET "handlingFee" = 99
WHERE "handlingFee" = 1;

UPDATE "Booking"
SET "payableAmount" = 99
WHERE "payableAmount" = 1;
