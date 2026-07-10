-- CreateEnum
CREATE TYPE "SupportTicketType" AS ENUM ('SUPPORT', 'DISPUTE');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('GENERAL', 'BOOKING', 'PAYMENT', 'GARAGE', 'SERVICE', 'WARRANTY', 'ACCOUNT', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisputeResolutionOutcome" AS ENUM ('CUSTOMER_FAVORED', 'GARAGE_FAVORED', 'PARTIAL_REFUND', 'NO_ACTION', 'MUTUAL_AGREEMENT');

-- CreateEnum
CREATE TYPE "SupportMessageAuthorType" AS ENUM ('CUSTOMER', 'ADMIN', 'INTERN', 'SYSTEM');

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "SupportTicketType" NOT NULL DEFAULT 'SUPPORT',
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolutionOutcome" "DisputeResolutionOutcome",
    "resolutionNote" TEXT,
    "refundAmount" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" "SupportMessageAuthorType" NOT NULL,
    "authorUserId" TEXT,
    "authorStaffId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_attachments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketCode_key" ON "support_tickets"("ticketCode");
CREATE INDEX "support_tickets_userId_updatedAt_idx" ON "support_tickets"("userId", "updatedAt");
CREATE INDEX "support_tickets_bookingId_idx" ON "support_tickets"("bookingId");
CREATE INDEX "support_tickets_assignedToId_status_idx" ON "support_tickets"("assignedToId", "status");
CREATE INDEX "support_tickets_type_status_priority_idx" ON "support_tickets"("type", "status", "priority");
CREATE INDEX "support_tickets_lastMessageAt_idx" ON "support_tickets"("lastMessageAt");
CREATE INDEX "support_ticket_messages_ticketId_createdAt_idx" ON "support_ticket_messages"("ticketId", "createdAt");
CREATE INDEX "support_ticket_messages_authorUserId_idx" ON "support_ticket_messages"("authorUserId");
CREATE INDEX "support_ticket_messages_authorStaffId_idx" ON "support_ticket_messages"("authorStaffId");
CREATE INDEX "support_ticket_attachments_ticketId_idx" ON "support_ticket_attachments"("ticketId");
CREATE INDEX "support_ticket_attachments_messageId_idx" ON "support_ticket_attachments"("messageId");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "staff_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_ticket_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
