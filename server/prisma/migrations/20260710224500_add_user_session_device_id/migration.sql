-- Track a stable browser/device identifier across login sessions.
ALTER TABLE "user_sessions" ADD COLUMN "deviceId" TEXT;

-- Speeds up per-customer unique device reporting in the admin dashboard.
CREATE INDEX "user_sessions_userId_deviceId_idx" ON "user_sessions"("userId", "deviceId");
