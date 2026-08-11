import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for the chatbot brain. Kept in its own file (not inside
 * lib/supabase.ts) so an accidental import from a "use client" component is
 * obvious in a diff, and the `server-only` import turns it into a build
 * failure instead of a leaked secret.
 *
 * The anon client in lib/supabase.ts is restricted to a single INSERT policy
 * on contact_messages. The brain's tables (documents, chunks, conversations,
 * messages, memory_facts, leads, registrations, and the rest of
 * supabase/schema.sql's V2 section) have RLS enabled with NO policies at
 * all — so only the service role key, which bypasses RLS unconditionally,
 * can read or write them. This key must never reach the browser: no
 * NEXT_PUBLIC_ prefix, no use in a "use client" file.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseServiceConfigured(): boolean {
  return Boolean(url && serviceRoleKey);
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseServiceConfigured()) return null;
  if (!cached) {
    cached = createClient(url!, serviceRoleKey!, {
      auth: { persistSession: false },
    });
  }
  return cached;
}
