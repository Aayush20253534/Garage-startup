-- CreateEnum
CREATE TYPE "SystemIssueSource" AS ENUM ('FRONTEND', 'BACKEND');

-- CreateEnum
CREATE TYPE "SystemIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SystemIssueStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SystemIssueActorType" AS ENUM ('CUSTOMER', 'GARAGE', 'ADMIN', 'PUBLIC', 'SYSTEM');

-- CreateTable
CREATE TABLE "SystemIssue" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "source" "SystemIssueSource" NOT NULL,
    "severity" "SystemIssueSeverity" NOT NULL DEFAULT 'ERROR',
    "status" "SystemIssueStatus" NOT NULL DEFAULT 'OPEN',
    "actorType" "SystemIssueActorType" NOT NULL DEFAULT 'PUBLIC',
    "userId" TEXT,
    "garageId" TEXT,
    "route" TEXT,
    "method" TEXT,
    "endpoint" TEXT,
    "httpStatus" INTEGER,
    "errorName" TEXT,
    "component" TEXT,
    "environment" TEXT,
    "release" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemIssue_fingerprint_key" ON "SystemIssue"("fingerprint");

-- CreateIndex
CREATE INDEX "SystemIssue_status_lastSeenAt_idx" ON "SystemIssue"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SystemIssue_severity_lastSeenAt_idx" ON "SystemIssue"("severity", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SystemIssue_actorType_lastSeenAt_idx" ON "SystemIssue"("actorType", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SystemIssue_source_lastSeenAt_idx" ON "SystemIssue"("source", "lastSeenAt");
