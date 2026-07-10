-- Add a dedicated author type for customer-support agents.
ALTER TYPE "SupportMessageAuthorType" ADD VALUE IF NOT EXISTS 'CUSTOMER_SUPPORT';

-- Dedicated customer-support accounts are deliberately separate from admin/intern staff accounts.
CREATE TABLE "customer_support_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_support_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_support_accounts_email_key"
ON "customer_support_accounts"("email");
CREATE INDEX "customer_support_accounts_isActive_idx"
ON "customer_support_accounts"("isActive");
CREATE INDEX "customer_support_accounts_lastLoginAt_idx"
ON "customer_support_accounts"("lastLoginAt");

-- Tickets use a dedicated customer-support assignee. The old assignedToId column is
-- retained for compatibility with historical admin/intern assignments.
ALTER TABLE "support_tickets"
ADD COLUMN "supportAssigneeId" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE INDEX "support_tickets_supportAssigneeId_status_idx"
ON "support_tickets"("supportAssigneeId", "status");

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_supportAssigneeId_fkey"
FOREIGN KEY ("supportAssigneeId") REFERENCES "customer_support_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages"
ADD COLUMN "authorSupportId" TEXT;

CREATE INDEX "support_ticket_messages_authorSupportId_idx"
ON "support_ticket_messages"("authorSupportId");

ALTER TABLE "support_ticket_messages"
ADD CONSTRAINT "support_ticket_messages_authorSupportId_fkey"
FOREIGN KEY ("authorSupportId") REFERENCES "customer_support_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "customer_support_notifications" (
    "id" TEXT NOT NULL,
    "supportAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_support_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_support_notifications_supportAccountId_isRead_createdAt_idx"
ON "customer_support_notifications"("supportAccountId", "isRead", "createdAt");

ALTER TABLE "customer_support_notifications"
ADD CONSTRAINT "customer_support_notifications_supportAccountId_fkey"
FOREIGN KEY ("supportAccountId") REFERENCES "customer_support_accounts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customer_support_email_logs" (
    "id" TEXT NOT NULL,
    "supportAccountId" TEXT NOT NULL,
    "userId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_support_email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_support_email_logs_supportAccountId_createdAt_idx"
ON "customer_support_email_logs"("supportAccountId", "createdAt");
CREATE INDEX "customer_support_email_logs_recipientEmail_idx"
ON "customer_support_email_logs"("recipientEmail");

ALTER TABLE "customer_support_email_logs"
ADD CONSTRAINT "customer_support_email_logs_supportAccountId_fkey"
FOREIGN KEY ("supportAccountId") REFERENCES "customer_support_accounts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
