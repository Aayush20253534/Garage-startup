-- Support-account received alerts now live in their own Notify schema/table.
-- This preserves all existing received alerts while separating them from the
-- existing customer-notification sending feature.
ALTER TABLE "customer_support_notifications" RENAME TO "notify";

ALTER INDEX "customer_support_notifications_supportAccountId_isRead_createdAt_idx"
RENAME TO "notify_supportAccountId_isRead_createdAt_idx";

ALTER TABLE "notify"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'SYSTEM';

CREATE INDEX "notify_type_createdAt_idx"
ON "notify"("type", "createdAt");

-- A support account needs its own Web Push subscriptions because customer
-- subscriptions belong to User records and must never be mixed with staff.
CREATE TABLE "customer_support_push_subscriptions" (
    "id" TEXT NOT NULL,
    "supportAccountId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_support_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_support_push_subscriptions_endpoint_key"
ON "customer_support_push_subscriptions"("endpoint");

CREATE INDEX "customer_support_push_subscriptions_supportAccountId_idx"
ON "customer_support_push_subscriptions"("supportAccountId");

ALTER TABLE "customer_support_push_subscriptions"
ADD CONSTRAINT "customer_support_push_subscriptions_supportAccountId_fkey"
FOREIGN KEY ("supportAccountId") REFERENCES "customer_support_accounts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
