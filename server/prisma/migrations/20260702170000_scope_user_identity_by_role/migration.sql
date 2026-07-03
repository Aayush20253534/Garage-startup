ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_phone_key";
ALTER TABLE "pending_signups" DROP CONSTRAINT IF EXISTS "pending_signups_email_key";
ALTER TABLE "pending_signups" DROP CONSTRAINT IF EXISTS "pending_signups_phone_key";

DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_phone_key";
DROP INDEX IF EXISTS "pending_signups_email_key";
DROP INDEX IF EXISTS "pending_signups_phone_key";

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_role_key" ON "User"("email", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_role_key" ON "User"("phone", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "pending_signups_email_role_key" ON "pending_signups"("email", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "pending_signups_phone_role_key" ON "pending_signups"("phone", "role");
