import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

/**
 * Plan states:
 *   trial   — signed up, currently in 14-day Pro trial
 *   free    — trial ended, on free tier (5 reveals/day, 3 personas, 10 history)
 *   active  — paying Pro customer
 *   lapsed  — was Pro, payment failed; treated like free until fixed
 */
export const planEnum = pgEnum("plan", ["trial", "free", "active", "lapsed"])

/**
 * Outcome of a check, for analytics + replay:
 *   completed — at least one recipient reading succeeded
 *   declined  — input rejected, model declined on all recipients, or rate limited
 *   error     — server/upstream failure
 */
export const outcomeEnum = pgEnum("check_outcome", [
  "completed",
  "declined",
  "error",
])

/* ──────────────── users ──────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Plan — everyone signs up as "free" (5 reveals/day + saved personas +
    // history). Pro trial is an explicit opt-in from /account, sets plan to
    // "trial" with the timestamps filled in. trial_ends_at is nullable
    // because most users will never start a trial.
    plan: planEnum("plan").default("free").notNull(),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),

    // Auth (one-token model: magic link IS the session token after activation)
    sessionToken: text("session_token"),
    sessionTokenCreatedAt: timestamp("session_token_created_at", {
      withTimezone: true,
    }),

    // Pending magic-link token (set during signup or "resend link" flow,
    // cleared once the user activates by clicking the link)
    pendingMagicToken: text("pending_magic_token"),
    pendingMagicExpiresAt: timestamp("pending_magic_expires_at", {
      withTimezone: true,
    }),

    // Stripe
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeSubscriptionStatus: text("stripe_subscription_status"),

    // Razorpay (India-friendly alternative; selected via PAYMENT_PROVIDER env)
    razorpayCustomerId: text("razorpay_customer_id"),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    razorpaySubscriptionStatus: text("razorpay_subscription_status"),

    // Activity
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
    sessionTokenUnique: uniqueIndex("users_session_token_unique").on(
      t.sessionToken
    ),
  })
)

/* ──────────────── personas ──────────────── */

export const personas = pgTable(
  "personas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // 1-30 chars, normalized lowercase
    context: text("context"), // optional one-liner about this person
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // A user can't have two personas with the same label
    userLabelUnique: uniqueIndex("personas_user_label_unique").on(
      t.userId,
      t.label
    ),
    userCreatedIdx: index("personas_user_created_idx").on(
      t.userId,
      t.createdAt
    ),
  })
)

/* ──────────────── checks ──────────────── */

export const checks = pgTable(
  "checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // [{archetype: string, context: string|null}]
    recipients: jsonb("recipients").notNull(),
    // {per_recipient: [...], meta: {...}, declined?: ...}
    results: jsonb("results"),
    outcome: outcomeEnum("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // For history list — fast user-scoped reverse-chronological scan
    userCreatedIdx: index("checks_user_created_idx").on(
      t.userId,
      t.createdAt
    ),
  })
)

/* ──────────────── anon_checks (per-IP daily throttle for anonymous checks) ──────────────── */

import { integer, date } from "drizzle-orm/pg-core"

/**
 * Daily counter per IP for anonymous draft-checks. Single row per IP-hash;
 * count + date reset atomically each day. Anon allowance: 3/day, single-
 * recipient only (multi-recipient unlocks at signup).
 */
export const anonChecks = pgTable("anon_checks", {
  // sha256(ip + server-side salt) — never stores raw IP
  ipHash: text("ip_hash").primaryKey(),
  checkCount: integer("check_count").default(0).notNull(),
  countDate: date("count_date").defaultNow().notNull(),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})
