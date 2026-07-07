-- ============================================================
-- 1. Create the separate staff role
-- ============================================================

CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'INTERN');


-- ============================================================
-- 2. Add INTERN as a system issue actor
-- ============================================================

ALTER TYPE "SystemIssueActorType"
ADD VALUE IF NOT EXISTS 'INTERN';


-- ============================================================
-- 3. Create the staff_accounts table
-- ============================================================

CREATE TABLE "staff_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);


-- ============================================================
-- 4. Create staff-account indexes
-- ============================================================

CREATE UNIQUE INDEX "staff_accounts_loginId_key"
ON "staff_accounts"("loginId");

CREATE UNIQUE INDEX "staff_accounts_email_key"
ON "staff_accounts"("email");

CREATE UNIQUE INDEX "staff_accounts_phone_key"
ON "staff_accounts"("phone");

CREATE INDEX "staff_accounts_role_idx"
ON "staff_accounts"("role");

CREATE INDEX "staff_accounts_isActive_idx"
ON "staff_accounts"("isActive");


-- ============================================================
-- 5. Copy existing ADMIN and INTERN accounts
-- ============================================================
-- Existing IDs and Argon2 password hashes are preserved.
-- Their old email value becomes their staff loginId.
-- Staff email remains NULL.

INSERT INTO "staff_accounts" (
    "id",
    "name",
    "loginId",
    "email",
    "phone",
    "password",
    "role",
    "isActive",
    "lastLoginAt",
    "passwordChangedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    LOWER("email"),
    NULL,
    NULL,
    "password",
    "role"::TEXT::"StaffRole",
    "isActive",
    NULL,
    NULL,
    "createdAt",
    "updatedAt"
FROM "User"
WHERE "role"::TEXT IN ('ADMIN', 'INTERN')
ON CONFLICT ("loginId") DO NOTHING;


-- ============================================================
-- 6. Remove invalid staff pending-signup records
-- ============================================================

DELETE FROM "pending_signups"
WHERE "role"::TEXT IN ('ADMIN', 'INTERN');


-- ============================================================
-- 7. Remove staff accounts from User
-- ============================================================

DELETE FROM "User"
WHERE "role"::TEXT IN ('ADMIN', 'INTERN');


-- ============================================================
-- 8. Replace Role with a user-only enum
-- ============================================================

BEGIN;

CREATE TYPE "Role_new" AS ENUM (
    'CUSTOMER',
    'GARAGE_OWNER'
);

ALTER TABLE "User"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "pending_signups"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
ALTER COLUMN "role"
TYPE "Role_new"
USING ("role"::TEXT::"Role_new");

ALTER TABLE "pending_signups"
ALTER COLUMN "role"
TYPE "Role_new"
USING ("role"::TEXT::"Role_new");

ALTER TYPE "Role" RENAME TO "Role_old";

ALTER TYPE "Role_new" RENAME TO "Role";

DROP TYPE "Role_old";

ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

ALTER TABLE "pending_signups"
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

COMMIT;