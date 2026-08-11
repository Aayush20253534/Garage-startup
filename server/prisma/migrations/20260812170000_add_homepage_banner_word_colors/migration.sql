ALTER TABLE "homepage_banners"
ADD COLUMN "headingColors" JSONB NOT NULL DEFAULT '[]'::jsonb;
