ALTER TYPE "public"."vendor_status" ADD VALUE 'draft' BEFORE 'pending';--> statement-breakpoint
ALTER TYPE "public"."vendor_status" ADD VALUE 'rejected' BEFORE 'suspended';--> statement-breakpoint
CREATE TABLE "admin_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "reviewed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_action_target_idx" ON "admin_action" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;