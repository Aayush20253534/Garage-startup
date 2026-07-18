ALTER TABLE "GarageWalletTransaction"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "GarageWalletTransaction_idempotencyKey_key"
  ON "GarageWalletTransaction"("idempotencyKey");
