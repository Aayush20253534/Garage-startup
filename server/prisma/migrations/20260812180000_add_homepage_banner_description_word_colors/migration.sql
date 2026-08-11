ALTER TABLE "homepage_banners"
ADD COLUMN "descriptionColors" JSONB NOT NULL DEFAULT '[]'::jsonb;
