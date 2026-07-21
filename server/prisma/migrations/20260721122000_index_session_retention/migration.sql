CREATE INDEX "garage_owner_sessions_expiresAt_idx" ON "garage_owner_sessions"("expiresAt");
CREATE INDEX "garage_owner_sessions_revokedAt_idx" ON "garage_owner_sessions"("revokedAt");
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");
CREATE INDEX "user_sessions_revokedAt_idx" ON "user_sessions"("revokedAt");
CREATE INDEX "staff_sessions_expiresAt_idx" ON "staff_sessions"("expiresAt");
CREATE INDEX "staff_sessions_revokedAt_idx" ON "staff_sessions"("revokedAt");
CREATE INDEX "customer_support_sessions_expiresAt_idx" ON "customer_support_sessions"("expiresAt");
CREATE INDEX "customer_support_sessions_revokedAt_idx" ON "customer_support_sessions"("revokedAt");
