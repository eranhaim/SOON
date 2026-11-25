ALTER TYPE "public"."calendar_entry_kind" ADD VALUE 'call';--> statement-breakpoint
CREATE TABLE "couple_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_a_id" uuid NOT NULL,
	"wedding_b_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"a_read_at" timestamp with time zone,
	"b_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couple_chat_pair_uq" UNIQUE("wedding_a_id","wedding_b_id"),
	CONSTRAINT "couple_chat_order_ck" CHECK ("couple_chat"."wedding_a_id" < "couple_chat"."wedding_b_id")
);
--> statement-breakpoint
CREATE TABLE "couple_chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wedding_invite" (
	"token" text PRIMARY KEY NOT NULL,
	"wedding_id" uuid NOT NULL,
	"created_by_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_entry" ADD COLUMN "wedding_id" uuid;--> statement-breakpoint
ALTER TABLE "availability_entry" ADD COLUMN "deposit_agorot" integer;--> statement-breakpoint
ALTER TABLE "wedding" ADD COLUMN "community_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding" ADD COLUMN "community_bio" text;--> statement-breakpoint
ALTER TABLE "couple_chat" ADD CONSTRAINT "couple_chat_wedding_a_id_wedding_id_fk" FOREIGN KEY ("wedding_a_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_chat" ADD CONSTRAINT "couple_chat_wedding_b_id_wedding_id_fk" FOREIGN KEY ("wedding_b_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_chat_message" ADD CONSTRAINT "couple_chat_message_chat_id_couple_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."couple_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couple_chat_message" ADD CONSTRAINT "couple_chat_message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_invite" ADD CONSTRAINT "wedding_invite_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_invite" ADD CONSTRAINT "wedding_invite_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wedding_invite" ADD CONSTRAINT "wedding_invite_used_by_user_id_user_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "couple_chat_b_idx" ON "couple_chat" USING btree ("wedding_b_id");--> statement-breakpoint
CREATE INDEX "couple_chat_message_chat_idx" ON "couple_chat_message" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "wedding_invite_wedding_idx" ON "wedding_invite" USING btree ("wedding_id");--> statement-breakpoint
ALTER TABLE "availability_entry" ADD CONSTRAINT "availability_entry_wedding_id_wedding_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."wedding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_wedding_idx" ON "availability_entry" USING btree ("wedding_id","starts_at");--> statement-breakpoint
ALTER TABLE "availability_entry" ADD CONSTRAINT "availability_deposit_ck" CHECK ("availability_entry"."deposit_agorot" IS NULL OR "availability_entry"."deposit_agorot" >= 0);--> statement-breakpoint
-- Entries already tied to a lead belong to that lead's wedding.
UPDATE "availability_entry" a SET "wedding_id" = l."wedding_id" FROM "lead" l WHERE a."lead_id" = l."id" AND a."wedding_id" IS NULL AND l."wedding_id" IS NOT NULL;
