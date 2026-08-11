ALTER TABLE "homepage_banners"
ADD COLUMN "heading" TEXT NOT NULL DEFAULT '',
ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

UPDATE "homepage_banners"
SET "heading" = "title"
WHERE "heading" = '';

ALTER TABLE "homepage_banners"
ALTER COLUMN "heading" DROP DEFAULT,
ALTER COLUMN "description" DROP DEFAULT;
