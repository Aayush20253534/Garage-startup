CREATE TABLE IF NOT EXISTS "homepage_banner_settings" (
    "id" TEXT NOT NULL DEFAULT 'homepage',
    "duration" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_banner_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "homepage_banner_settings" ("id", "duration", "updatedAt")
VALUES ('homepage', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "homepage_banners" DROP COLUMN IF EXISTS "duration";
