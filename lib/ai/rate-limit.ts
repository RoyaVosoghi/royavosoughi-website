import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSecurityConfig } from "./security-config";
import type { Channel } from "./types";

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
 * Window/max come from security_config (/admin/security), env-var defaults
 * apply until that row is edited.
 */
export async function checkRateLimit(
  channel: Channel,
  channelSessionId: string,
  ip: string | null,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return true;

  const { rateLimitWindowMinutes, rateLimitMaxMessages } = await getSecurityConfig();
  const since = new Date(Date.now() - rateLimitWindowMinutes * 60_000).toISOString();
  const sKey = sessionKey(channel, channelSessionId);

  const sessionCount = await countHits(supabase, sKey, since);
  if (sessionCount >= rateLimitMaxMessages) return false;

  if (ip) {
    const iKey = ipKey(ip);
    const ipCount = await countHits(supabase, iKey, since);
    if (ipCount >= rateLimitMaxMessages) return false;
  }

  const hits = [{ hit_key: sKey }, ...(ip ? [{ hit_key: ipKey(ip) }] : [])];
  const { error } = await supabase.from("rate_limit_hits").insert(hits);
  if (error) console.error("[rate-limit] insert failed:", error.message);

  return true;
}
