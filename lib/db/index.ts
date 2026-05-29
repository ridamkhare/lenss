import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import * as schema from "./schema"

/**
 * Database client — Neon serverless over HTTP.
 *
 * `neon-http` is the right driver for Next.js API routes on Vercel
 * (works in both Node.js and Edge runtimes; no connection pooling issues
 * because each query is a single HTTPS request).
 *
 * For long transactions or many sequential queries, swap to
 * `drizzle-orm/neon-serverless` (which uses WebSockets). Not needed for v1.
 */

if (!process.env.DATABASE_URL) {
  // Throw at import time during local/server work so a missing connection
  // string shows up immediately, not at first query.
  // In dev this means you must have DATABASE_URL in .env.local before next
  // dev / build can run any code that touches the db module.
  throw new Error("DATABASE_URL is not set. Add it to .env.local (see .env.local.example).")
}

const client = neon(process.env.DATABASE_URL)
export const db = drizzle(client, { schema })

export { schema }
