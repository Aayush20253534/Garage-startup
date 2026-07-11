-- Track user password changes so existing customer sessions can be invalidated.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- Add revocable server-side sessions for admin and intern accounts.
CREATE TABLE "staff_sessions" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_sessions_staffAccountId_expiresAt_idx" ON "staff_sessions"("staffAccountId", "expiresAt");
CREATE INDEX "staff_sessions_staffAccountId_deviceId_idx" ON "staff_sessions"("staffAccountId", "deviceId");
CREATE INDEX "staff_sessions_lastSeenAt_idx" ON "staff_sessions"("lastSeenAt");

ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staffAccountId_fkey"
FOREIGN KEY ("staffAccountId") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add revocable server-side sessions for customer support accounts.
CREATE TABLE "customer_support_sessions" (
    "id" TEXT NOT NULL,
    "supportAccountId" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_support_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_support_sessions_supportAccountId_expiresAt_idx" ON "customer_support_sessions"("supportAccountId", "expiresAt");
CREATE INDEX "customer_support_sessions_supportAccountId_deviceId_idx" ON "customer_support_sessions"("supportAccountId", "deviceId");
CREATE INDEX "customer_support_sessions_lastSeenAt_idx" ON "customer_support_sessions"("lastSeenAt");

ALTER TABLE "customer_support_sessions" ADD CONSTRAINT "customer_support_sessions_supportAccountId_fkey"
FOREIGN KEY ("supportAccountId") REFERENCES "customer_support_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
