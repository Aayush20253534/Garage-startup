ALTER TABLE "customer_activities"
ADD COLUMN "eventKey" TEXT;

CREATE UNIQUE INDEX "customer_activities_eventKey_key"
ON "customer_activities"("eventKey");
