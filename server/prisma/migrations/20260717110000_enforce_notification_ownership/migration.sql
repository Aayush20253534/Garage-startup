-- Legacy broadcast rows had no owner and were visible to every customer.
-- New broadcasts are materialized per recipient, so discard ambiguous rows
-- before enforcing the account-ownership invariant at the database boundary.
DELETE FROM "Notification"
WHERE
  ("userId" IS NULL AND "garageOwnerId" IS NULL)
  OR ("userId" IS NOT NULL AND "garageOwnerId" IS NOT NULL);

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_exactly_one_owner_check"
CHECK (
  ("userId" IS NOT NULL AND "garageOwnerId" IS NULL)
  OR ("userId" IS NULL AND "garageOwnerId" IS NOT NULL)
);
