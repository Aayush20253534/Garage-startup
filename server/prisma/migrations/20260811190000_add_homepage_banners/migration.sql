CREATE TABLE "homepage_banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homepage_banners_isActive_position_idx"
ON "homepage_banners"("isActive", "position");

CREATE TABLE "homepage_banner_settings" (
    "id" TEXT NOT NULL DEFAULT 'homepage',
    "duration" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_banner_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "homepage_banner_settings" ("id", "duration", "updatedAt")
VALUES ('homepage', 5, CURRENT_TIMESTAMP);
