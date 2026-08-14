ALTER TABLE "staff_accounts" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "staff_accounts" ADD COLUMN "avatarPublicId" TEXT;

ALTER TABLE "customer_support_accounts" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "customer_support_accounts" ADD COLUMN "avatarPublicId" TEXT;

ALTER TABLE "garage_owners" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "garage_owners" ADD COLUMN "avatarPublicId" TEXT;

ALTER TABLE "garage_controllers" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "garage_controllers" ADD COLUMN "avatarPublicId" TEXT;
