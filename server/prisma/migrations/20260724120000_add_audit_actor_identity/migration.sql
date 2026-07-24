ALTER TABLE "admin_audit_logs"
  ADD COLUMN "actorEmail" TEXT,
  ADD COLUMN "actorLoginId" TEXT;

-- Preserve the exact staff account identity for audit entries created before
-- these snapshot columns existed.
UPDATE "admin_audit_logs" AS audit
SET
  "actorEmail" = staff."email",
  "actorLoginId" = staff."loginId"
FROM "staff_accounts" AS staff
WHERE audit."actorId" = staff."id"
  AND (audit."actorEmail" IS NULL OR audit."actorLoginId" IS NULL);

CREATE INDEX "admin_audit_logs_actorEmail_createdAt_idx"
  ON "admin_audit_logs"("actorEmail", "createdAt");

CREATE INDEX "admin_audit_logs_actorLoginId_createdAt_idx"
  ON "admin_audit_logs"("actorLoginId", "createdAt");
