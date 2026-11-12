CREATE TYPE "public"."availability_status" AS ENUM('available', 'pending', 'booked', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'meeting', 'proposal', 'booked', 'completed', 'pending', 'lost', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('pending', 'approved', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."wedding_category_status" AS ENUM('needed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."wedding_member_role" AS ENUM('partner', 'producer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('couple', 'vendor', 'admin');--> statement-breakpoint
CREATE TABLE "availability_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "availability_status" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"title" text,
	"lead_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_range_ck" CHECK ("availability_entry"."starts_at" < "availability_entry"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"slug" text PRIMARY KEY NOT NULL,
	"label_he" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"wedding_id" uuid NOT NULL,
	"lead_id" uuid,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_vendor_wedding_uq" UNIQUE("vendor_id","wedding_id")
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"wedding_id" uuid,
	"client_name" text,
	"client_phone" text,
	"client_email" text,
	"event_date" date,
	"location" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"quoted_price_agorot" integer,
	"notes" text,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_vendor_wedding_uq" UNIQUE("vendor_id","wedding_id"),
	CONSTRAINT "lead_has_client_ck" CHECK ("lead"."wedding_id" IS NOT NULL OR "lead"."client_name" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text,
	"attachment_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "message_not_empty_ck" CHECK ("message"."body" IS NOT NULL OR "message"."attachment_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "saved_vendor" (
	"wedding_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"saved_by_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_vendor_wedding_id_vendor_id_pk" PRIMARY KEY("wedding_id","vendor_id")
);
--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"business_name" text NOT NULL,
	"slug" text NOT NULL,
	"category_slug" text NOT NULL,
	"status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"about" text,
	"phone" text,
	"email" text,
	"website_url" text,
	"instagram_url" text,
	"logo_url" text,
	"cover_url" text,
	"price_from_agorot" integer,
	"price_to_agorot" integer,
	"cancellation_policy" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_slug_unique" UNIQUE("slug"),
	CONSTRAINT "vendor_price_range_ck" CHECK ("vendor"."price_from_agorot" IS NULL OR "vendor"."price_to_agorot" IS NULL OR "vendor"."price_from_agorot" <= "vendor"."price_to_agorot")
);
--> statement-breakpoint
CREATE TABLE "vendor_faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"kind" "media_kind" DEFAULT 'image' NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_agorot" integer,
	"includes" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_region" (
	"vendor_id" uuid NOT NULL,
	"region" text NOT NULL,
	CONSTRAINT "vendor_region_vendor_id_region_pk" PRIMARY KEY("vendor_id","region")
);
--> statement-breakpoint
CREATE TABLE "wedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner1_name" text NOT NULL,
	"partner2_name" text NOT NULL,
	"wedding_date" date,
	"region" text,
	"venue_name" text,
	"budget_total_agorot" integer,
	"cover_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_category" (
	"wedding_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	"status" "wedding_category_status" NOT NULL,
	CONSTRAINT "wedding_category_wedding_id_category_slug_pk" PRIMARY KEY("wedding_id","category_slug")
);
--> statement-breakpoint
CREATE TABLE "wedding_member" (
	"wedding_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "wedding_member_role" DEFAULT 'partner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_member_wedding_id_user_id_pk" PRIMARY KEY("wedding_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role",
	"phone" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_entry" ADD CONSTRAINT "availability_entry_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_entry" ADD CONSTRAINT "availability_entry_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vendor" ADD CONSTRAINT "saved_vendor_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vendor" ADD CONSTRAINT "saved_vendor_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vendor" ADD CONSTRAINT "saved_vendor_saved_by_user_id_user_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_category_slug_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."category"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_faq" ADD CONSTRAINT "vendor_faq_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_media" ADD CONSTRAINT "vendor_media_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_package" ADD CONSTRAINT "vendor_package_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_region" ADD CONSTRAINT "vendor_region_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_category" ADD CONSTRAINT "wedding_category_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_category" ADD CONSTRAINT "wedding_category_category_slug_category_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."category"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_member" ADD CONSTRAINT "wedding_member_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_member" ADD CONSTRAINT "wedding_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_vendor_range_idx" ON "availability_entry" USING btree ("vendor_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "conversation_wedding_idx" ON "conversation" USING btree ("wedding_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversation_vendor_idx" ON "conversation" USING btree ("vendor_id","last_message_at");--> statement-breakpoint
CREATE INDEX "lead_vendor_status_idx" ON "lead" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX "lead_vendor_event_date_idx" ON "lead" USING btree ("vendor_id","event_date");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "vendor_owner_idx" ON "vendor" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "vendor_category_status_idx" ON "vendor" USING btree ("category_slug","status");--> statement-breakpoint
CREATE INDEX "vendor_faq_vendor_idx" ON "vendor_faq" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_media_vendor_idx" ON "vendor_media" USING btree ("vendor_id","sort_order");--> statement-breakpoint
CREATE INDEX "vendor_package_vendor_idx" ON "vendor_package" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_region_region_idx" ON "vendor_region" USING btree ("region");--> statement-breakpoint
CREATE INDEX "wedding_member_user_idx" ON "wedding_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");