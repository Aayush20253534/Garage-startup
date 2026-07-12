-- Add explicit booking linkage and database-enforced idempotency to the
-- customer wallet ledger. Nullable unique values preserve existing rows.
ALTER TABLE "WalletTransaction"
  ADD COLUMN "bookingId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key"
  ON "WalletTransaction"("idempotencyKey");

CREATE INDEX "WalletTransaction_bookingId_idx"
  ON "WalletTransaction"("bookingId");

ALTER TABLE "WalletTransaction"
  ADD CONSTRAINT "WalletTransaction_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
