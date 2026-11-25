CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"background_url" text,
	"paper_color" text DEFAULT '#FBF7F1' NOT NULL,
	"text_color" text DEFAULT '#2B1E1C' NOT NULL,
	"accent_color" text DEFAULT '#B48A4E' NOT NULL,
	"font" text DEFAULT 'serif' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_charge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"amount_agorot" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"error" text,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_payment_method" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"token" text NOT NULL,
	"last4" text,
	"brand" text,
	"expiry" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_blessing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_gift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"giver_name" text NOT NULL,
	"giver_phone" text,
	"blessing" text,
	"amount_agorot" integer NOT NULL,
	"fee_agorot" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_gift_amount_ck" CHECK ("wedding_gift"."amount_agorot" > 0 and "wedding_gift"."fee_agorot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wedding_site" (
	"wedding_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"template_id" uuid,
	"published" boolean DEFAULT false NOT NULL,
	"cover_url" text,
	"story" text,
	"details" jsonb DEFAULT '{"schedule":[]}'::jsonb NOT NULL,
	"rsvp_enabled" boolean DEFAULT true NOT NULL,
	"gifts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_site_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "guest" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_charge" ADD CONSTRAINT "vendor_charge_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_method" ADD CONSTRAINT "vendor_payment_method_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_blessing" ADD CONSTRAINT "wedding_blessing_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_gift" ADD CONSTRAINT "wedding_gift_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_site" ADD CONSTRAINT "wedding_site_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_site" ADD CONSTRAINT "wedding_site_template_id_invitation_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."invitation_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_charge_vendor_idx" ON "vendor_charge" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE INDEX "wedding_blessing_wedding_idx" ON "wedding_blessing" USING btree ("wedding_id","created_at");--> statement-breakpoint
CREATE INDEX "wedding_gift_wedding_idx" ON "wedding_gift" USING btree ("wedding_id","created_at");