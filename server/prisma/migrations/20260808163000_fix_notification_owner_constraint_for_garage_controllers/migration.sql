-- Garage controller accounts were added as a third valid Notification owner,
-- but the original database CHECK constraint still allowed only customers or
-- garage owners. That mismatch caused every controller notification insert to
-- fail with SQLSTATE 23514.
--
-- Keep the same constraint name so operational tooling can continue to refer
-- to one invariant while expanding it to all three supported account types.
ALTER TABLE "Notification"
DROP CONSTRAINT IF EXISTS "Notification_exactly_one_owner_check";

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_exactly_one_owner_check"
CHECK (num_nonnulls("userId", "garageOwnerId", "garageControllerId") = 1);
