CREATE TABLE "garage_application_email_outbox" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garage_application_email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "garage_application_email_outbox_dedupeKey_key"
ON "garage_application_email_outbox"("dedupeKey");

CREATE INDEX "garage_application_email_outbox_applicationId_idx"
ON "garage_application_email_outbox"("applicationId");

CREATE INDEX "garage_application_email_outbox_status_nextAttemptAt_idx"
ON "garage_application_email_outbox"("status", "nextAttemptAt");

CREATE INDEX "garage_application_email_outbox_status_lockedAt_idx"
ON "garage_application_email_outbox"("status", "lockedAt");

ALTER TABLE "garage_application_email_outbox"
ADD CONSTRAINT "garage_application_email_outbox_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "GarageApplication"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
