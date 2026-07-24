ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';

ALTER TABLE "staff_accounts"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT;

CREATE TABLE IF NOT EXISTS "booking_events" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "actorName" TEXT,
  "actorRole" TEXT,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "previousValue" JSONB,
  "nextValue" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_events_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "booking_reassignments" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "previousGarageId" TEXT,
  "previousGarageName" TEXT,
  "newGarageId" TEXT NOT NULL,
  "newGarageName" TEXT NOT NULL,
  "reason" TEXT,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "customerNotified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_reassignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_reassignments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "booking_events_bookingId_createdAt_idx" ON "booking_events"("bookingId", "createdAt");
CREATE INDEX IF NOT EXISTS "booking_events_eventType_createdAt_idx" ON "booking_events"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "booking_events_actorId_createdAt_idx" ON "booking_events"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "booking_reassignments_bookingId_createdAt_idx" ON "booking_reassignments"("bookingId", "createdAt");
CREATE INDEX IF NOT EXISTS "booking_reassignments_actorId_createdAt_idx" ON "booking_reassignments"("actorId", "createdAt");

CREATE OR REPLACE FUNCTION rovauto_event_id(seed TEXT DEFAULT '') RETURNS TEXT AS $$
DECLARE digest TEXT;
BEGIN
  digest := md5(random()::TEXT || clock_timestamp()::TEXT || seed);
  RETURN substr(digest,1,8)||'-'||substr(digest,9,4)||'-4'||substr(digest,14,3)||'-a'||substr(digest,18,3)||'-'||substr(digest,21,12);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rovauto_booking_actor_type() RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(NULLIF(current_setting('rovauto.actor_type', true), ''), 'SYSTEM');
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION rovauto_booking_actor_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('rovauto.actor_id', true), '');
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION rovauto_booking_actor_name() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('rovauto.actor_name', true), '');
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION rovauto_booking_actor_role() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('rovauto.actor_role', true), '');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rovauto_insert_booking_event(
  p_booking_id TEXT,
  p_event_type TEXT,
  p_title TEXT,
  p_detail TEXT DEFAULT NULL,
  p_previous JSONB DEFAULT NULL,
  p_next JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) RETURNS VOID AS $$
BEGIN
  INSERT INTO "booking_events"(
    "id", "bookingId", "actorType", "actorId", "actorName", "actorRole",
    "eventType", "title", "detail", "previousValue", "nextValue", "metadata", "createdAt"
  ) VALUES (
    rovauto_event_id(p_booking_id || p_event_type), p_booking_id,
    rovauto_booking_actor_type(), rovauto_booking_actor_id(), rovauto_booking_actor_name(), rovauto_booking_actor_role(),
    p_event_type, p_title, p_detail, p_previous, p_next, p_metadata, p_created_at
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rovauto_booking_event_trigger() RETURNS TRIGGER AS $$
DECLARE old_garage_name TEXT; new_garage_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'BOOKING_CREATED', 'Booking created', 'Initial status: ' || NEW.status::TEXT, NULL, jsonb_build_object('status', NEW.status::TEXT, 'scheduledDate', NEW."scheduledDate", 'requestType', NEW."requestType"::TEXT), jsonb_build_object('bookingCode', NEW."bookingCode", 'userId', NEW."userId", 'vehicleId', NEW."vehicleId"), NEW."createdAt");
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'STATUS_CHANGED', 'Booking status changed', OLD.status::TEXT || ' → ' || NEW.status::TEXT, to_jsonb(OLD.status::TEXT), to_jsonb(NEW.status::TEXT));
  END IF;
  IF OLD."garageId" IS DISTINCT FROM NEW."garageId" THEN
    SELECT name INTO old_garage_name FROM "Garage" WHERE id = OLD."garageId";
    SELECT name INTO new_garage_name FROM "Garage" WHERE id = NEW."garageId";
    PERFORM rovauto_insert_booking_event(NEW.id,
      CASE WHEN OLD."garageId" IS NULL THEN 'GARAGE_ASSIGNED' WHEN NEW."garageId" IS NULL THEN 'GARAGE_UNASSIGNED' ELSE 'GARAGE_REASSIGNED' END,
      CASE WHEN OLD."garageId" IS NULL THEN 'Garage assigned' WHEN NEW."garageId" IS NULL THEN 'Garage unassigned' ELSE 'Garage reassigned' END,
      COALESCE(old_garage_name, 'Unassigned') || ' → ' || COALESCE(new_garage_name, 'Unassigned'),
      jsonb_build_object('garageId', OLD."garageId", 'garageName', old_garage_name),
      jsonb_build_object('garageId', NEW."garageId", 'garageName', new_garage_name));
  END IF;
  IF OLD."garageControllerId" IS DISTINCT FROM NEW."garageControllerId" THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'CONTROLLER_CHANGED', 'Garage controller changed', NULL,
      jsonb_build_object('controllerId', OLD."garageControllerId"), jsonb_build_object('controllerId', NEW."garageControllerId"));
  END IF;
  IF ROW(OLD."scheduledDate", OLD."startTime", OLD."endTime") IS DISTINCT FROM ROW(NEW."scheduledDate", NEW."startTime", NEW."endTime") THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'SCHEDULE_CHANGED', 'Booking schedule changed', NULL,
      jsonb_build_object('scheduledDate', OLD."scheduledDate", 'startTime', OLD."startTime", 'endTime', OLD."endTime"),
      jsonb_build_object('scheduledDate', NEW."scheduledDate", 'startTime', NEW."startTime", 'endTime', NEW."endTime"));
  END IF;
  IF ROW(OLD."customerAddress", OLD."customerLatitude", OLD."customerLongitude") IS DISTINCT FROM ROW(NEW."customerAddress", NEW."customerLatitude", NEW."customerLongitude") THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'LOCATION_CHANGED', 'Service location changed', NEW."customerAddress",
      jsonb_build_object('address', OLD."customerAddress", 'latitude', OLD."customerLatitude", 'longitude', OLD."customerLongitude"),
      jsonb_build_object('address', NEW."customerAddress", 'latitude', NEW."customerLatitude", 'longitude', NEW."customerLongitude"));
  END IF;
  IF ROW(OLD."handlingFee", OLD."payableAmount", OLD."totalServiceAmount", OLD."totalServiceMaxAmount") IS DISTINCT FROM ROW(NEW."handlingFee", NEW."payableAmount", NEW."totalServiceAmount", NEW."totalServiceMaxAmount") THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'PRICING_CHANGED', 'Booking pricing changed', NULL,
      jsonb_build_object('handlingFee', OLD."handlingFee", 'payableAmount', OLD."payableAmount", 'totalServiceAmount', OLD."totalServiceAmount", 'totalServiceMaxAmount', OLD."totalServiceMaxAmount"),
      jsonb_build_object('handlingFee', NEW."handlingFee", 'payableAmount', NEW."payableAmount", 'totalServiceAmount', NEW."totalServiceAmount", 'totalServiceMaxAmount', NEW."totalServiceMaxAmount"));
  END IF;
  IF OLD."searchExpiresAt" IS DISTINCT FROM NEW."searchExpiresAt" THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'SEARCH_WINDOW_CHANGED', 'Garage search window changed', NULL, to_jsonb(OLD."searchExpiresAt"), to_jsonb(NEW."searchExpiresAt"));
  END IF;
  IF OLD."handoverOtpVerifiedAt" IS NULL AND NEW."handoverOtpVerifiedAt" IS NOT NULL THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'HANDOVER_VERIFIED', 'Vehicle handover verified', NULL, NULL, to_jsonb(NEW."handoverOtpVerifiedAt"));
  END IF;
  IF OLD."trackingStartedAt" IS NULL AND NEW."trackingStartedAt" IS NOT NULL THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'TRACKING_STARTED', 'Service tracking started', NULL, NULL, to_jsonb(NEW."trackingStartedAt"));
  END IF;
  IF OLD."trackingEndedAt" IS NULL AND NEW."trackingEndedAt" IS NOT NULL THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'TRACKING_ENDED', 'Service tracking ended', NULL, NULL, to_jsonb(NEW."trackingEndedAt"));
  END IF;
  IF OLD."deliveredAt" IS NULL AND NEW."deliveredAt" IS NOT NULL THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'VEHICLE_DELIVERED', 'Garage marked vehicle delivered', NULL, NULL, to_jsonb(NEW."deliveredAt"));
  END IF;
  IF OLD."customerAcceptedAt" IS NULL AND NEW."customerAcceptedAt" IS NOT NULL THEN
    PERFORM rovauto_insert_booking_event(NEW.id, 'DELIVERY_ACCEPTED', 'Customer accepted vehicle delivery', NULL, NULL, to_jsonb(NEW."customerAcceptedAt"));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rovauto_booking_events_trigger ON "Booking";
CREATE TRIGGER rovauto_booking_events_trigger AFTER INSERT OR UPDATE ON "Booking" FOR EACH ROW EXECUTE FUNCTION rovauto_booking_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_broadcast_event_trigger() RETURNS TRIGGER AS $$
DECLARE garage_name TEXT;
BEGIN
  SELECT name INTO garage_name FROM "Garage" WHERE id = NEW."garageId";
  IF TG_OP = 'INSERT' THEN
    PERFORM rovauto_insert_booking_event(NEW."bookingId", 'GARAGE_REQUEST_SENT', 'Booking request sent to garage', garage_name, NULL, jsonb_build_object('status', NEW.status::TEXT, 'searchCycle', NEW."searchCycle", 'searchRound', NEW."searchRound", 'searchRadiusKm', NEW."searchRadiusKm"), jsonb_build_object('requestId', NEW.id, 'garageId', NEW."garageId", 'garageName', garage_name), NEW."sentAt");
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM rovauto_insert_booking_event(NEW."bookingId", 'GARAGE_REQUEST_' || NEW.status::TEXT, 'Garage request ' || lower(NEW.status::TEXT), garage_name, to_jsonb(OLD.status::TEXT), to_jsonb(NEW.status::TEXT), jsonb_build_object('garageId', NEW."garageId", 'garageName', garage_name, 'note', NEW."garageResponseNote"));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_broadcast_events_trigger ON "GarageBroadcastRequest";
CREATE TRIGGER rovauto_broadcast_events_trigger AFTER INSERT OR UPDATE ON "GarageBroadcastRequest" FOR EACH ROW EXECUTE FUNCTION rovauto_broadcast_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_payment_event_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."bookingId" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM rovauto_insert_booking_event(NEW."bookingId", 'PAYMENT_CREATED', 'Payment initiated', 'Amount: ₹' || NEW.amount::TEXT, NULL, jsonb_build_object('amount', NEW.amount, 'currency', NEW.currency, 'status', NEW.status::TEXT, 'walletAmountUsed', NEW."walletAmountUsed", 'upiAmountPaid', NEW."upiAmountPaid"), jsonb_build_object('paymentId', NEW.id, 'cashfreeOrderId', NEW."cashfreeOrderId"), NEW."createdAt");
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM rovauto_insert_booking_event(NEW."bookingId", 'PAYMENT_STATUS_CHANGED', 'Payment status changed', OLD.status::TEXT || ' → ' || NEW.status::TEXT, to_jsonb(OLD.status::TEXT), to_jsonb(NEW.status::TEXT), jsonb_build_object('paymentId', NEW.id, 'cashfreeOrderId', NEW."cashfreeOrderId", 'cashfreePaymentId', NEW."cashfreePaymentId"));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_payment_events_trigger ON "Payment";
CREATE TRIGGER rovauto_payment_events_trigger AFTER INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION rovauto_payment_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_booking_service_event_trigger() RETURNS TRIGGER AS $$
DECLARE booking_id TEXT; service_id TEXT; service_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    booking_id := OLD."bookingId";
    service_id := OLD."serviceId";
  ELSE
    booking_id := NEW."bookingId";
    service_id := NEW."serviceId";
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "Booking" WHERE id = booking_id) THEN
    RETURN OLD;
  END IF;
  SELECT name INTO service_name FROM "Service" WHERE id = service_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM rovauto_insert_booking_event(booking_id, 'SERVICE_ADDED', 'Service added to booking', service_name, NULL, to_jsonb(NEW), jsonb_build_object('serviceId', NEW."serviceId", 'serviceName', service_name), NEW."createdAt");
  ELSIF TG_OP = 'UPDATE' AND ROW(OLD.quantity, OLD."estimatedPrice", OLD."finalPrice", OLD."estimatedMinPrice", OLD."estimatedMaxPrice") IS DISTINCT FROM ROW(NEW.quantity, NEW."estimatedPrice", NEW."finalPrice", NEW."estimatedMinPrice", NEW."estimatedMaxPrice") THEN
    PERFORM rovauto_insert_booking_event(booking_id, 'SERVICE_PRICE_CHANGED', 'Booking service pricing changed', service_name, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('serviceId', NEW."serviceId", 'serviceName', service_name));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM rovauto_insert_booking_event(booking_id, 'SERVICE_REMOVED', 'Service removed from booking', service_name, to_jsonb(OLD), NULL, jsonb_build_object('serviceId', OLD."serviceId", 'serviceName', service_name));
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_booking_service_events_trigger ON "BookingService";
CREATE TRIGGER rovauto_booking_service_events_trigger AFTER INSERT OR UPDATE OR DELETE ON "BookingService" FOR EACH ROW EXECUTE FUNCTION rovauto_booking_service_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_inspection_event_trigger() RETURNS TRIGGER AS $$
BEGIN
  PERFORM rovauto_insert_booking_event(NEW."bookingId", 'INSPECTION_IMAGE_ADDED', 'Inspection image added', NEW.phase::TEXT, NULL, jsonb_build_object('phase', NEW.phase::TEXT, 'imageId', NEW.id), NULL, NEW."createdAt");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_inspection_events_trigger ON "BookingInspectionImage";
CREATE TRIGGER rovauto_inspection_events_trigger AFTER INSERT ON "BookingInspectionImage" FOR EACH ROW EXECUTE FUNCTION rovauto_inspection_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_complaint_event_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."bookingId" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM rovauto_insert_booking_event(NEW."bookingId", 'COMPLAINT_CREATED', 'Complaint created', NEW.title, NULL, jsonb_build_object('status', NEW.status::TEXT, 'title', NEW.title), jsonb_build_object('complaintId', NEW.id), NEW."createdAt");
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM rovauto_insert_booking_event(NEW."bookingId", 'COMPLAINT_STATUS_CHANGED', 'Complaint status changed', OLD.status::TEXT || ' → ' || NEW.status::TEXT, to_jsonb(OLD.status::TEXT), to_jsonb(NEW.status::TEXT), jsonb_build_object('complaintId', NEW.id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_complaint_events_trigger ON "Complaint";
CREATE TRIGGER rovauto_complaint_events_trigger AFTER INSERT OR UPDATE ON "Complaint" FOR EACH ROW EXECUTE FUNCTION rovauto_complaint_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_review_event_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "booking_events"(
      "id", "bookingId", "actorType", "actorId", "actorName", "actorRole",
      "eventType", "title", "detail", "nextValue", "metadata", "createdAt"
    ) VALUES (
      rovauto_event_id(NEW."bookingId" || 'review'), NEW."bookingId", 'CUSTOMER', NEW."userId", NULL, 'CUSTOMER',
      'REVIEW_SUBMITTED', 'Customer review submitted', NEW.rating::TEXT || ' star rating',
      jsonb_build_object('rating', NEW.rating, 'comment', NEW.comment),
      jsonb_build_object('reviewId', NEW.id, 'garageId', NEW."garageId"), NEW."createdAt"
    );
  ELSIF ROW(OLD.rating, OLD.comment) IS DISTINCT FROM ROW(NEW.rating, NEW.comment) THEN
    INSERT INTO "booking_events"(
      "id", "bookingId", "actorType", "actorId", "actorName", "actorRole",
      "eventType", "title", "detail", "previousValue", "nextValue", "metadata", "createdAt"
    ) VALUES (
      rovauto_event_id(NEW."bookingId" || 'review-update'), NEW."bookingId", 'CUSTOMER', NEW."userId", NULL, 'CUSTOMER',
      'REVIEW_UPDATED', 'Customer review updated', NEW.rating::TEXT || ' star rating',
      jsonb_build_object('rating', OLD.rating, 'comment', OLD.comment),
      jsonb_build_object('rating', NEW.rating, 'comment', NEW.comment),
      jsonb_build_object('reviewId', NEW.id, 'garageId', NEW."garageId"), CURRENT_TIMESTAMP
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_review_events_trigger ON "Review";
CREATE TRIGGER rovauto_review_events_trigger AFTER INSERT OR UPDATE ON "Review" FOR EACH ROW EXECUTE FUNCTION rovauto_review_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_support_ticket_event_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."bookingId" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM rovauto_insert_booking_event(
      NEW."bookingId", 'SUPPORT_TICKET_CREATED', 'Support ticket created', NEW.subject,
      NULL, jsonb_build_object('status', NEW.status::TEXT, 'priority', NEW.priority::TEXT),
      jsonb_build_object('ticketId', NEW.id, 'ticketCode', NEW."ticketCode", 'category', NEW.category::TEXT), NEW."createdAt"
    );
  ELSIF ROW(OLD.status, OLD.priority, OLD."resolutionOutcome", OLD."refundAmount") IS DISTINCT FROM ROW(NEW.status, NEW.priority, NEW."resolutionOutcome", NEW."refundAmount") THEN
    PERFORM rovauto_insert_booking_event(
      NEW."bookingId", 'SUPPORT_TICKET_UPDATED', 'Support ticket updated', NEW.subject,
      jsonb_build_object('status', OLD.status::TEXT, 'priority', OLD.priority::TEXT, 'resolutionOutcome', OLD."resolutionOutcome", 'refundAmount', OLD."refundAmount"),
      jsonb_build_object('status', NEW.status::TEXT, 'priority', NEW.priority::TEXT, 'resolutionOutcome', NEW."resolutionOutcome", 'refundAmount', NEW."refundAmount"),
      jsonb_build_object('ticketId', NEW.id, 'ticketCode', NEW."ticketCode")
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_support_ticket_events_trigger ON "support_tickets";
CREATE TRIGGER rovauto_support_ticket_events_trigger AFTER INSERT OR UPDATE ON "support_tickets" FOR EACH ROW EXECUTE FUNCTION rovauto_support_ticket_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_support_message_event_trigger() RETURNS TRIGGER AS $$
DECLARE booking_id TEXT; ticket_code TEXT;
BEGIN
  SELECT "bookingId", "ticketCode" INTO booking_id, ticket_code FROM "support_tickets" WHERE id = NEW."ticketId";
  IF booking_id IS NULL OR NEW."isInternal" THEN RETURN NEW; END IF;
  INSERT INTO "booking_events"(
    "id", "bookingId", "actorType", "actorId", "actorName", "actorRole",
    "eventType", "title", "detail", "metadata", "createdAt"
  ) VALUES (
    rovauto_event_id(booking_id || NEW.id), booking_id,
    CASE NEW."authorType"::TEXT WHEN 'CUSTOMER' THEN 'CUSTOMER' WHEN 'SYSTEM' THEN 'SYSTEM' ELSE 'STAFF' END,
    COALESCE(NEW."authorStaffId", NEW."authorSupportId", NEW."authorUserId"), NEW."authorName", NEW."authorType"::TEXT,
    'SUPPORT_MESSAGE_ADDED', 'Support message added', left(NEW.body, 500),
    jsonb_build_object('ticketId', NEW."ticketId", 'ticketCode', ticket_code, 'messageId', NEW.id), NEW."createdAt"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_support_message_events_trigger ON "support_ticket_messages";
CREATE TRIGGER rovauto_support_message_events_trigger AFTER INSERT ON "support_ticket_messages" FOR EACH ROW EXECUTE FUNCTION rovauto_support_message_event_trigger();

CREATE OR REPLACE FUNCTION rovauto_wallet_booking_event_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."bookingId" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM rovauto_insert_booking_event(
      NEW."bookingId", 'WALLET_TRANSACTION_CREATED', 'Wallet transaction recorded', NEW.type::TEXT || ': ₹' || NEW.amount::TEXT,
      NULL, jsonb_build_object('status', NEW.status::TEXT, 'amount', NEW.amount, 'balanceAfter', NEW."balanceAfter"),
      jsonb_build_object('walletTransactionId', NEW.id, 'type', NEW.type::TEXT), NEW."createdAt"
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM rovauto_insert_booking_event(
      NEW."bookingId", 'WALLET_TRANSACTION_STATUS_CHANGED', 'Wallet transaction status changed', OLD.status::TEXT || ' → ' || NEW.status::TEXT,
      to_jsonb(OLD.status::TEXT), to_jsonb(NEW.status::TEXT),
      jsonb_build_object('walletTransactionId', NEW.id, 'type', NEW.type::TEXT, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rovauto_wallet_booking_events_trigger ON "WalletTransaction";
CREATE TRIGGER rovauto_wallet_booking_events_trigger AFTER INSERT OR UPDATE ON "WalletTransaction" FOR EACH ROW EXECUTE FUNCTION rovauto_wallet_booking_event_trigger();

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(b.id || 'backfill-created'), b.id, 'SYSTEM', 'BOOKING_CREATED', 'Booking created',
  'Historical booking imported; current status at migration: ' || b.status::TEXT,
  jsonb_build_object('statusAtMigration', b.status::TEXT, 'scheduledDate', b."scheduledDate", 'requestType', b."requestType"::TEXT),
  jsonb_build_object('backfilled', true, 'backfillKey', b.id || ':booking-created', 'bookingCode', b."bookingCode"), b."createdAt"
FROM "Booking" b
WHERE NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = b.id || ':booking-created');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(b.id || event_data.event_key), b.id, 'SYSTEM', event_data.event_type, event_data.title, event_data.detail,
  event_data.next_value, jsonb_build_object('backfilled', true, 'backfillKey', b.id || ':' || event_data.event_key), event_data.event_at
FROM "Booking" b
CROSS JOIN LATERAL (
  VALUES
    ('garage-accepted', 'GARAGE_ASSIGNED', 'Garage assigned', NULL::TEXT, to_jsonb(b."garageId"), b."acceptedAt"),
    ('handover-verified', 'HANDOVER_VERIFIED', 'Vehicle handover verified', NULL::TEXT, to_jsonb(b."handoverOtpVerifiedAt"), b."handoverOtpVerifiedAt"),
    ('tracking-started', 'TRACKING_STARTED', 'Service tracking started', NULL::TEXT, to_jsonb(b."trackingStartedAt"), b."trackingStartedAt"),
    ('tracking-ended', 'TRACKING_ENDED', 'Service tracking ended', NULL::TEXT, to_jsonb(b."trackingEndedAt"), b."trackingEndedAt"),
    ('vehicle-delivered', 'VEHICLE_DELIVERED', 'Garage marked vehicle delivered', NULL::TEXT, to_jsonb(b."deliveredAt"), b."deliveredAt"),
    ('delivery-accepted', 'DELIVERY_ACCEPTED', 'Customer accepted vehicle delivery', NULL::TEXT, to_jsonb(b."customerAcceptedAt"), b."customerAcceptedAt"),
    ('booking-expired', 'BOOKING_EXPIRED', 'Booking expired', NULL::TEXT, to_jsonb(b."expiredAt"), b."expiredAt")
) AS event_data(event_key, event_type, title, detail, next_value, event_at)
WHERE event_data.event_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = b.id || ':' || event_data.event_key);

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(r.id || ':sent'), r."bookingId", 'SYSTEM', 'GARAGE_REQUEST_SENT', 'Booking request sent to garage', g.name,
  jsonb_build_object('status', r.status::TEXT, 'searchCycle', r."searchCycle", 'searchRound', r."searchRound", 'searchRadiusKm', r."searchRadiusKm"),
  jsonb_build_object('backfilled', true, 'backfillKey', r.id || ':broadcast-sent', 'requestId', r.id, 'garageId', r."garageId", 'garageName', g.name), r."sentAt"
FROM "GarageBroadcastRequest" r JOIN "Garage" g ON g.id = r."garageId"
WHERE NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = r.id || ':broadcast-sent');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(r.id || ':final'), r."bookingId", 'SYSTEM', 'GARAGE_REQUEST_' || r.status::TEXT,
  'Garage request ' || lower(r.status::TEXT), g.name, to_jsonb(r.status::TEXT),
  jsonb_build_object('backfilled', true, 'backfillKey', r.id || ':broadcast-final', 'requestId', r.id, 'garageId', r."garageId", 'garageName', g.name, 'note', r."garageResponseNote"),
  COALESCE(r."acceptedAt", r."rejectedAt", r."expiredAt", r."updatedAt")
FROM "GarageBroadcastRequest" r JOIN "Garage" g ON g.id = r."garageId"
WHERE r.status::TEXT <> 'SENT'
  AND NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = r.id || ':broadcast-final');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(p.id || ':created'), p."bookingId", 'SYSTEM', 'PAYMENT_CREATED', 'Payment initiated', 'Amount: ₹' || p.amount::TEXT,
  jsonb_build_object('amount', p.amount, 'currency', p.currency, 'status', p.status::TEXT, 'walletAmountUsed', p."walletAmountUsed", 'upiAmountPaid', p."upiAmountPaid"),
  jsonb_build_object('backfilled', true, 'backfillKey', p.id || ':payment-created', 'paymentId', p.id, 'cashfreeOrderId', p."cashfreeOrderId"), p."createdAt"
FROM "Payment" p
WHERE NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = p.id || ':payment-created');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(p.id || ':status'), p."bookingId", 'SYSTEM', 'PAYMENT_STATUS_SNAPSHOT', 'Payment status recorded', p.status::TEXT,
  to_jsonb(p.status::TEXT), jsonb_build_object('backfilled', true, 'backfillKey', p.id || ':payment-status', 'paymentId', p.id, 'cashfreePaymentId', p."cashfreePaymentId"), p."updatedAt"
FROM "Payment" p
WHERE (p.status::TEXT <> 'CREATED' OR p."updatedAt" > p."createdAt")
  AND NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = p.id || ':payment-status');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(bs.id || ':service'), bs."bookingId", 'SYSTEM', 'SERVICE_ADDED', 'Service recorded on booking', s.name,
  jsonb_build_object('quantity', bs.quantity, 'estimatedPrice', bs."estimatedPrice", 'estimatedMinPrice', bs."estimatedMinPrice", 'estimatedMaxPrice', bs."estimatedMaxPrice", 'finalPrice', bs."finalPrice"),
  jsonb_build_object('backfilled', true, 'backfillKey', bs.id || ':service', 'bookingServiceId', bs.id, 'serviceId', bs."serviceId", 'serviceName', s.name), bs."createdAt"
FROM "BookingService" bs JOIN "Service" s ON s.id = bs."serviceId"
WHERE NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = bs.id || ':service');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(i.id || ':inspection'), i."bookingId", 'SYSTEM', 'INSPECTION_IMAGE_ADDED', 'Inspection image added', i.phase::TEXT,
  jsonb_build_object('phase', i.phase::TEXT, 'imageId', i.id), jsonb_build_object('backfilled', true, 'backfillKey', i.id || ':inspection'), i."createdAt"
FROM "BookingInspectionImage" i
WHERE NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = i.id || ':inspection');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(c.id || ':complaint'), c."bookingId", 'SYSTEM', 'COMPLAINT_CREATED', 'Complaint recorded', c.title,
  jsonb_build_object('status', c.status::TEXT, 'title', c.title), jsonb_build_object('backfilled', true, 'backfillKey', c.id || ':complaint', 'complaintId', c.id), c."createdAt"
FROM "Complaint" c
WHERE c."bookingId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = c.id || ':complaint');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "actorId", "actorRole", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(r.id || ':review'), r."bookingId", 'CUSTOMER', r."userId", 'CUSTOMER', 'REVIEW_SUBMITTED', 'Customer review recorded', r.rating::TEXT || ' star rating',
  jsonb_build_object('rating', r.rating, 'comment', r.comment), jsonb_build_object('backfilled', true, 'backfillKey', r.id || ':review', 'reviewId', r.id, 'garageId', r."garageId"), r."createdAt"
FROM "Review" r
WHERE NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = r.id || ':review');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(t.id || ':ticket'), t."bookingId", 'SYSTEM', 'SUPPORT_TICKET_CREATED', 'Support ticket recorded', t.subject,
  jsonb_build_object('status', t.status::TEXT, 'priority', t.priority::TEXT, 'resolutionOutcome', t."resolutionOutcome", 'refundAmount', t."refundAmount"),
  jsonb_build_object('backfilled', true, 'backfillKey', t.id || ':ticket', 'ticketId', t.id, 'ticketCode', t."ticketCode", 'category', t.category::TEXT), t."createdAt"
FROM "support_tickets" t
WHERE t."bookingId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = t.id || ':ticket');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "actorId", "actorName", "actorRole", "eventType", "title", "detail", "metadata", "createdAt")
SELECT rovauto_event_id(t."bookingId" || m.id), t."bookingId",
  CASE m."authorType"::TEXT WHEN 'CUSTOMER' THEN 'CUSTOMER' WHEN 'SYSTEM' THEN 'SYSTEM' ELSE 'STAFF' END,
  COALESCE(m."authorStaffId", m."authorSupportId", m."authorUserId"), m."authorName", m."authorType"::TEXT,
  'SUPPORT_MESSAGE_ADDED', 'Support message recorded', left(m.body, 500),
  jsonb_build_object('backfilled', true, 'backfillKey', m.id || ':support-message', 'ticketId', t.id, 'ticketCode', t."ticketCode", 'messageId', m.id), m."createdAt"
FROM "support_ticket_messages" m JOIN "support_tickets" t ON t.id = m."ticketId"
WHERE t."bookingId" IS NOT NULL AND NOT m."isInternal"
  AND NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = m.id || ':support-message');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "eventType", "title", "detail", "nextValue", "metadata", "createdAt")
SELECT rovauto_event_id(w.id || ':wallet'), w."bookingId", 'SYSTEM', 'WALLET_TRANSACTION_CREATED', 'Wallet transaction recorded', w.type::TEXT || ': ₹' || w.amount::TEXT,
  jsonb_build_object('status', w.status::TEXT, 'amount', w.amount, 'balanceAfter', w."balanceAfter"),
  jsonb_build_object('backfilled', true, 'backfillKey', w.id || ':wallet', 'walletTransactionId', w.id, 'type', w.type::TEXT), w."createdAt"
FROM "WalletTransaction" w
WHERE w."bookingId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'backfillKey' = w.id || ':wallet');

INSERT INTO "booking_events" ("id", "bookingId", "actorType", "actorId", "actorName", "actorRole", "eventType", "title", "detail", "metadata", "createdAt")
SELECT rovauto_event_id(a.id || 'admin'), a."bookingId", 'STAFF', a."staffId", a."staffName", 'ADMIN',
  CASE a.action WHEN 'NOTE' THEN 'ADMIN_NOTE' WHEN 'STATUS_CHANGED' THEN 'ADMIN_STATUS_CHANGED' WHEN 'GARAGE_REASSIGNED' THEN 'GARAGE_REASSIGNED' ELSE 'ADMIN_ACTION' END,
  CASE a.action WHEN 'NOTE' THEN 'Internal admin note' WHEN 'STATUS_CHANGED' THEN 'Status changed by admin' WHEN 'GARAGE_REASSIGNED' THEN 'Garage reassigned by admin' ELSE 'Admin action' END,
  a.note, COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object('legacyAdminEventId', a.id, 'backfilled', true), a."createdAt"
FROM "admin_booking_events" a
WHERE NOT EXISTS (SELECT 1 FROM "booking_events" e WHERE e.metadata->>'legacyAdminEventId' = a.id);

INSERT INTO "booking_reassignments" ("id", "bookingId", "previousGarageId", "previousGarageName", "newGarageId", "newGarageName", "reason", "actorId", "actorName", "actorRole", "customerNotified", "createdAt")
SELECT rovauto_event_id(a.id || 'reassign'), a."bookingId", a.metadata->>'fromGarageId', a.metadata->>'fromGarageName', a.metadata->>'toGarageId', COALESCE(a.metadata->>'toGarageName', 'Garage'), a.note, a."staffId", a."staffName", 'ADMIN', true, a."createdAt"
FROM "admin_booking_events" a
WHERE a.action = 'GARAGE_REASSIGNED' AND a.metadata->>'toGarageId' IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "booking_reassignments" r WHERE r."bookingId" = a."bookingId" AND r."createdAt" = a."createdAt");
