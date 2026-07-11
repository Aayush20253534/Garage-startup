ALTER TYPE "SystemIssueActorType" ADD VALUE IF NOT EXISTS 'CUSTOMER_SUPPORT';

ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'DELETE_ACCOUNT';

ALTER TABLE "Otp" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "staff_login_challenges" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "deliveryEmail" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_login_challenges_accountId_accountType_key"
ON "staff_login_challenges"("accountId", "accountType");

CREATE INDEX "staff_login_challenges_expiresAt_idx"
ON "staff_login_challenges"("expiresAt");
