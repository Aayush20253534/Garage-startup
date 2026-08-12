CREATE TABLE "independence_campaign" (
    "id" TEXT NOT NULL DEFAULT 'independence-day',
    "mode" TEXT NOT NULL DEFAULT 'OFF',
    "manualEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByStaffId" TEXT,
    "updatedByStaffName" TEXT,
    CONSTRAINT "independence_campaign_pkey" PRIMARY KEY ("id")
);

INSERT INTO "independence_campaign" ("id", "mode", "manualEnabled", "updatedAt")
VALUES ('independence-day', 'OFF', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
