import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Channel } from "./types";

const WINDOW_MINUTES = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MINUTES ?? 10);
const MAX_MESSAGES = Number(process.env.CHAT_RATE_LIMIT_MAX_MESSAGES ?? 20);

function sessionKey(channel: Channel, channelSessionId: string): string {
  return `session:${channel}:${channelSessionId}`;
}

function ipKey(ip: string): string {
  return `ip:${ip}`;
}

async function countHits(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, key: string, since: string) {
  const { count, error } = await supabase
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("hit_key", key)
    .gte("created_at", since);

  if (error) {
    console.error("[rate-limit] count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Dual-keyed on session id AND IP independently, so clearing localStorage
 * (which mints a new session id) doesn't reset the limit for that visitor.
 * Fails open if Supabase isn't configured — the route's own
 * isSupabaseServiceConfigured() gate handles that case before this runs.
 */
export async function checkRateLimit(
  channel: Channel,
  channelSessionId: string,
  ip: string | null,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return true;

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const sKey = sessionKey(channel, channelSessionId);

  const sessionCount = await countHits(supabase, sKey, since);
  if (sessionCount >= MAX_MESSAGES) return false;

  if (ip) {
    const iKey = ipKey(ip);
    const ipCount = await countHits(supabase, iKey, since);
    if (ipCount >= MAX_MESSAGES) return false;
  }

  const hits = [{ hit_key: sKey }, ...(ip ? [{ hit_key: ipKey(ip) }] : [])];
  const { error } = await supabase.from("rate_limit_hits").insert(hits);
  if (error) console.error("[rate-limit] insert failed:", error.message);

  return true;
}
