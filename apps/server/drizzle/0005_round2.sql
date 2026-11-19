CREATE TABLE "client_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"number" integer NOT NULL,
	"issued_on" date NOT NULL,
	"lead_id" uuid,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"description" text NOT NULL,
	"amount_agorot" integer NOT NULL,
	"payment_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_document_number_uq" UNIQUE("vendor_id","kind","number")
);
--> statement-breakpoint
CREATE TABLE "vendor_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount_agorot" integer NOT NULL,
	"spent_on" date NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"receipt_url" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_song" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"url" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "booked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "plan" text DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "plan_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "calendar_token" text;--> statement-breakpoint
ALTER TABLE "wedding" ADD COLUMN "invitation" jsonb;--> statement-breakpoint
ALTER TABLE "client_document" ADD CONSTRAINT "client_document_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_document" ADD CONSTRAINT "client_document_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_expense" ADD CONSTRAINT "vendor_expense_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_song" ADD CONSTRAINT "wedding_song_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_document_vendor_idx" ON "client_document" USING btree ("vendor_id","issued_on");--> statement-breakpoint
CREATE INDEX "vendor_expense_vendor_idx" ON "vendor_expense" USING btree ("vendor_id","spent_on");--> statement-breakpoint
CREATE INDEX "wedding_song_wedding_idx" ON "wedding_song" USING btree ("wedding_id","stage","sort_order");--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_calendar_token_unique" UNIQUE("calendar_token");--> statement-breakpoint
UPDATE "lead" SET "booked_at" = "updated_at" WHERE "status" IN ('booked', 'completed') AND "booked_at" IS NULL;
