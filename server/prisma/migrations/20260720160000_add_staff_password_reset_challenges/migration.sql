CREATE TABLE "staff_password_reset_challenges" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_password_reset_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_password_reset_challenges_staffAccountId_key"
ON "staff_password_reset_challenges"("staffAccountId");

CREATE INDEX "staff_password_reset_challenges_expiresAt_idx"
ON "staff_password_reset_challenges"("expiresAt");

ALTER TABLE "staff_password_reset_challenges"
ADD CONSTRAINT "staff_password_reset_challenges_staffAccountId_fkey"
FOREIGN KEY ("staffAccountId") REFERENCES "staff_accounts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
