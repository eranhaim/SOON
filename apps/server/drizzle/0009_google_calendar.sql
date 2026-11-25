CREATE TABLE "vendor_google_calendar" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"refresh_token" text NOT NULL,
	"calendar_id" text NOT NULL,
	"google_email" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "vendor_google_calendar" ADD CONSTRAINT "vendor_google_calendar_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;