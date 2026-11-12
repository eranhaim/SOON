-- A vendor can never have two overlapping BOOKED slots (spec §11: prevent conflicts).
-- Pending / available / unavailable entries may overlap freely.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "availability_entry"
  ADD CONSTRAINT "availability_no_double_booking"
  EXCLUDE USING gist (
    "vendor_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" = 'booked');
