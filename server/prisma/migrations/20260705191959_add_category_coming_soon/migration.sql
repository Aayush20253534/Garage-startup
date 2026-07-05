-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN     "isComingSoon" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ServiceCategory_isComingSoon_idx" ON "ServiceCategory"("isComingSoon");
