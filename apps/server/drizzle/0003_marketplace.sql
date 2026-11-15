CREATE TYPE "public"."calendar_entry_kind" AS ENUM('event', 'meeting', 'personal', 'other');--> statement-breakpoint
CREATE TYPE "public"."guest_side" AS ENUM('bride', 'groom', 'shared');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('app', 'manual');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('invited', 'confirmed', 'declined', 'waiting');--> statement-breakpoint
CREATE TYPE "public"."wedding_event_kind" AS ENUM('meeting', 'tasting', 'fitting', 'trial', 'payment', 'deadline', 'other');--> statement-breakpoint
CREATE TABLE "budget_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"vendor_id" uuid,
	"vendor_name" text,
	"planned_agorot" integer,
	"actual_agorot" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"name" text NOT NULL,
	"side" "guest_side" DEFAULT 'shared' NOT NULL,
	"phone" text,
	"rsvp" "rsvp_status" DEFAULT 'invited' NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"table_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_party_size_ck" CHECK ("guest"."party_size" between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "lead_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount_agorot" integer NOT NULL,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_payment_amount_ck" CHECK ("lead_payment"."amount_agorot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"wedding_id" uuid NOT NULL,
	"author_user_id" text,
	"rating" integer NOT NULL,
	"rating_professionalism" integer,
	"rating_service" integer,
	"rating_availability" integer,
	"rating_value" integer,
	"body" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"status" "review_status" DEFAULT 'published' NOT NULL,
	"vendor_reply" text,
	"vendor_replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_vendor_wedding_uq" UNIQUE("vendor_id","wedding_id"),
	CONSTRAINT "review_ratings_ck" CHECK ("review"."rating" between 1 and 5
        and ("review"."rating_professionalism" is null or "review"."rating_professionalism" between 1 and 5)
        and ("review"."rating_service" is null or "review"."rating_service" between 1 and 5)
        and ("review"."rating_availability" is null or "review"."rating_availability" between 1 and 5)
        and ("review"."rating_value" is null or "review"."rating_value" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "review_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_user_id" text,
	"reason" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_report_once_uq" UNIQUE("review_id","reporter_user_id")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"due_date" date,
	"remind_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"category_slug" text,
	"template_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_wedding_template_uq" UNIQUE("wedding_id","template_key")
);
--> statement-breakpoint
CREATE TABLE "vendor_stat_daily" (
	"vendor_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vendor_stat_daily_vendor_id_day_pk" PRIMARY KEY("vendor_id","day")
);
--> statement-breakpoint
CREATE TABLE "wedding_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"kind" "wedding_event_kind" DEFAULT 'meeting' NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text,
	"vendor_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_event_range_ck" CHECK ("wedding_event"."ends_at" IS NULL OR "wedding_event"."starts_at" < "wedding_event"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "wedding_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"budget_item_id" uuid,
	"title" text NOT NULL,
	"amount_agorot" integer NOT NULL,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_payment_amount_ck" CHECK ("wedding_payment"."amount_agorot" >= 0)
);
--> statement-breakpoint
ALTER TABLE "availability_entry" ADD COLUMN "kind" "calendar_entry_kind" DEFAULT 'event' NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_entry" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "vendor_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "wedding_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "source" "lead_source" DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "guest_count" integer;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "package_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned_reason" text;--> statement-breakpoint
ALTER TABLE "budget_item" ADD CONSTRAINT "budget_item_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_item" ADD CONSTRAINT "budget_item_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest" ADD CONSTRAINT "guest_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_payment" ADD CONSTRAINT "lead_payment_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_category_slug_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."category"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_stat_daily" ADD CONSTRAINT "vendor_stat_daily_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_event" ADD CONSTRAINT "wedding_event_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_event" ADD CONSTRAINT "wedding_event_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_payment" ADD CONSTRAINT "wedding_payment_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_payment" ADD CONSTRAINT "wedding_payment_budget_item_id_budget_item_id_fk" FOREIGN KEY ("budget_item_id") REFERENCES "public"."budget_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_item_wedding_idx" ON "budget_item" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "guest_wedding_idx" ON "guest" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX "lead_payment_lead_idx" ON "lead_payment" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "review_vendor_status_idx" ON "review" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX "review_report_open_idx" ON "review_report" USING btree ("resolved_at","created_at");--> statement-breakpoint
CREATE INDEX "task_wedding_due_idx" ON "task" USING btree ("wedding_id","due_date");--> statement-breakpoint
CREATE INDEX "wedding_event_wedding_idx" ON "wedding_event" USING btree ("wedding_id","starts_at");--> statement-breakpoint
CREATE INDEX "wedding_payment_wedding_idx" ON "wedding_payment" USING btree ("wedding_id","due_date");--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_package_id_vendor_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."vendor_package"("id") ON DELETE set null ON UPDATE no action;