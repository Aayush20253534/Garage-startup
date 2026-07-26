BEGIN;

CREATE TYPE "BookingInspectionMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "BookingInspectionImage"
  ADD COLUMN "mediaType" "BookingInspectionMediaType" NOT NULL DEFAULT 'IMAGE';

DROP INDEX IF EXISTS "BookingInspectionImage_bookingId_phase_order_key";

CREATE UNIQUE INDEX "BookingInspectionImage_bookingId_phase_mediaType_order_key"
  ON "BookingInspectionImage"("bookingId", "phase", "mediaType", "order");

CREATE INDEX "BookingInspectionImage_mediaType_idx"
  ON "BookingInspectionImage"("mediaType");

CREATE OR REPLACE FUNCTION rovauto_inspection_event_trigger() RETURNS TRIGGER AS $$
DECLARE media_label TEXT;
BEGIN
  media_label := CASE WHEN NEW."mediaType"::TEXT = 'VIDEO' THEN 'video' ELSE 'image' END;
  PERFORM rovauto_insert_booking_event(
    NEW."bookingId",
    'INSPECTION_MEDIA_ADDED',
    'Inspection ' || media_label || ' added',
    NEW.phase::TEXT,
    NULL,
    jsonb_build_object(
      'phase', NEW.phase::TEXT,
      'mediaId', NEW.id,
      'mediaType', NEW."mediaType"::TEXT
    ),
    NULL,
    NEW."createdAt"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
