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

    // Plan
    plan: planEnum("plan").default("trial").notNull(),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true })
      .default(sql`now() + interval '14 days'`)
      .notNull(),

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

/* ──────────────── anon_checks (IP-throttle for first anonymous check) ──────────────── */

export const anonChecks = pgTable("anon_checks", {
  // sha256(ip + server-side salt) — never stores raw IP
  ipHash: text("ip_hash").primaryKey(),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})
