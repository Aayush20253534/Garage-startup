-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "isComingSoon" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Service_isComingSoon_idx" ON "Service"("isComingSoon");
