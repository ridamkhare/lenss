CREATE TYPE "public"."check_outcome" AS ENUM('completed', 'declined', 'error');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'free', 'active', 'lapsed');--> statement-breakpoint
CREATE TABLE "anon_checks" (
	"ip_hash" text PRIMARY KEY NOT NULL,
	"last_check_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"recipients" jsonb NOT NULL,
	"results" jsonb,
	"outcome" "check_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"trial_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp with time zone DEFAULT now() + interval '14 days' NOT NULL,
	"session_token" text,
	"session_token_created_at" timestamp with time zone,
	"pending_magic_token" text,
	"pending_magic_expires_at" timestamp with time zone,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"last_active_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checks_user_created_idx" ON "checks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "personas_user_label_unique" ON "personas" USING btree ("user_id","label");--> statement-breakpoint
CREATE INDEX "personas_user_created_idx" ON "personas" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_session_token_unique" ON "users" USING btree ("session_token");