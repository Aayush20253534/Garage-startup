-- Persist the current radius round so garage matching survives restarts and
-- can reliably cycle through 5 km, 10 km, and 20 km searches.
ALTER TABLE "Booking"
  ADD COLUMN "garageSearchRound" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "garageSearchCycle" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "searchRadiusKm" INTEGER;

-- The request row is reused per booking/garage. These fields record the cycle
-- in which it was last sent, preventing duplicate alerts inside one radius pass.
ALTER TABLE "GarageBroadcastRequest"
  ADD COLUMN "searchCycle" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "searchRound" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "searchRadiusKm" INTEGER NOT NULL DEFAULT 5;

-- Existing in-flight searches may already have request rows from the old
-- batch-based strategy. Mark them as having completed a pass so their next
-- worker run restarts cleanly at 5 km in cycle 2.
UPDATE "Booking"
SET "garageSearchRound" = 3
WHERE "status" = 'SEARCHING_GARAGE'
  AND "garageId" IS NULL;
