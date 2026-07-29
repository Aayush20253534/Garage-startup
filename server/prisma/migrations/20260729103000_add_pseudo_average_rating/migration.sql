-- Optional public average-rating override while pseudo data is enabled.
ALTER TABLE "platform_pseudo_data"
  ADD COLUMN IF NOT EXISTS "pseudoAverageRating" DOUBLE PRECISION;

ALTER TABLE "platform_pseudo_data"
  DROP CONSTRAINT IF EXISTS "platform_pseudo_data_rating_range";

ALTER TABLE "platform_pseudo_data"
  ADD CONSTRAINT "platform_pseudo_data_rating_range"
  CHECK (
    "pseudoAverageRating" IS NULL
    OR ("pseudoAverageRating" >= 1 AND "pseudoAverageRating" <= 5)
  );
