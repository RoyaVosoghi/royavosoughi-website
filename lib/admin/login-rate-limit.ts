import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Brute-force guard for /api/admin/login — reuses the same rate_limit_hits
 * table the chat channels use (see lib/ai/rate-limit.ts), but keyed and
 * thresholded separately: only *failed* attempts count as a hit (a
 * legitimate admin logging in repeatedly never locks themselves out), and
 * the window is tighter since this guards credential stuffing, not chat abuse.
 */
const WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

function emailKey(email: string): string {
  return `admin-login:email:${email.trim().toLowerCase()}`;
}

function ipKey(ip: string): string {
  return `admin-login:ip:${ip}`;
}

async function countHits(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, key: string, since: string) {
  const { count, error } = await supabase
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("hit_key", key)
    .gte("created_at", since);

  if (error) {
    console.error("[admin login] rate limit count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Fails open (never locks anyone out) if Supabase isn't configured — the route's own isSupabaseServiceConfigured() gate handles that case before this runs. */
export async function isLoginLocked(email: string, ip: string | null): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const emailAttempts = await countHits(supabase, emailKey(email), since);
  if (emailAttempts >= MAX_FAILED_ATTEMPTS) return true;

  if (ip) {
    const ipAttempts = await countHits(supabase, ipKey(ip), since);
    if (ipAttempts >= MAX_FAILED_ATTEMPTS) return true;
  }

  return false;
}

export async function recordFailedLogin(email: string, ip: string | null): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const hits = [{ hit_key: emailKey(email) }, ...(ip ? [{ hit_key: ipKey(ip) }] : [])];
  const { error } = await supabase.from("rate_limit_hits").insert(hits);
  if (error) console.error("[admin login] failed to record attempt:", error.message);
}
