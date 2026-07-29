-- Public homepage pseudo counts (display-only boosts; no real accounts created).
CREATE TABLE IF NOT EXISTS "platform_pseudo_data" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "extraUsers" INTEGER NOT NULL DEFAULT 0,
    "extraGarages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByStaffId" TEXT,
    "updatedByStaffName" TEXT,

    CONSTRAINT "platform_pseudo_data_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_pseudo_data_extra_non_negative"
      CHECK ("extraUsers" >= 0 AND "extraGarages" >= 0)
);

INSERT INTO "platform_pseudo_data" ("id", "enabled", "extraUsers", "extraGarages", "updatedAt")
VALUES ('default', false, 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
