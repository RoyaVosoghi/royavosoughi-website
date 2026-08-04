import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The site is designed to build and deploy BEFORE the Supabase account exists.
 * Every caller must check this first and degrade gracefully — the contact form
 * falls back to a mailto: link rather than throwing.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let cached: SupabaseClient | null = null;

/**
 * Anon-key client, used server-side only.
 * The anon key is enough because RLS grants exactly one privilege: INSERT into
 * contact_messages. There is no SELECT policy, so this key cannot read anything.
 * That is deliberate — see supabase/schema.sql.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createClient(url!, anonKey!, {
      auth: { persistSession: false },
    });
  }
  return cached;
}
