ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "trial_started_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "trial_started_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "trial_ends_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "trial_ends_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "anon_checks" ADD COLUMN "check_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "anon_checks" ADD COLUMN "count_date" date DEFAULT now() NOT NULL;