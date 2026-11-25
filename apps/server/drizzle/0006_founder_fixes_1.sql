ALTER TABLE "vendor" ADD COLUMN "contact_first_name" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "plan_active_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_faq" ADD COLUMN "template_key" text;--> statement-breakpoint
-- One budget line per category: keep the oldest line, move later duplicates to "other" (no data lost).
UPDATE "budget_item" b SET "category" = 'other'
WHERE b."category" <> 'other'
  AND EXISTS (
    SELECT 1 FROM "budget_item" o
    WHERE o."wedding_id" = b."wedding_id" AND o."category" = b."category"
      AND (o."created_at", o."id") < (b."created_at", b."id")
  );--> statement-breakpoint
CREATE UNIQUE INDEX "budget_item_wedding_category_uq" ON "budget_item" USING btree ("wedding_id","category") WHERE "budget_item"."category" <> 'other';--> statement-breakpoint
ALTER TABLE "vendor_faq" ADD CONSTRAINT "vendor_faq_template_uq" UNIQUE("vendor_id","template_key");--> statement-breakpoint
-- First name from the account's full name.
UPDATE "vendor" v SET "contact_first_name" = split_part(trim(u."name"), ' ', 1)
FROM "user" u WHERE u."id" = v."owner_user_id" AND coalesce(trim(u."name"), '') <> '';--> statement-breakpoint
-- Vendors already on a paid plan get the free first month from today.
UPDATE "vendor" SET "plan_active_until" = now() + interval '30 days' WHERE "plan" <> 'basic';
