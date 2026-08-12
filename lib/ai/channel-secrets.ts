import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * DB-editable secrets for channels that need "save & take an action" in the
 * admin panel (today: just Telegram's bot token + webhook secret, so
 * /admin/channels can call setWebhook directly instead of pointing Roya at
 * a CLI script). Same protection boundary as every other v2/v3 table —
 * service-role RLS only — which is the same trust level env vars already
 * had, so this isn't a downgrade.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: string | null; expiresAt: number }>();

export async function getChannelSecret(channel: string, key: string): Promise<string | null> {
  const cacheKey = `${channel}:${key}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("channel_secrets")
    .select("value")
    .eq("channel", channel)
    .eq("key", key)
    .maybeSingle();

  if (error) console.error("[channel-secrets] fetch failed:", error.message);
  const value = data?.value ?? null;
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function setChannelSecret(channel: string, key: string, value: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("channel_secrets")
    .upsert({ channel, key, value, updated_at: new Date().toISOString() }, { onConflict: "channel,key" });
  if (error) throw error;

  cache.delete(`${channel}:${key}`);
}

/** Last 4 characters only — enough for an admin to confirm "yes, that's the right bot" without the full secret round-tripping to the browser again. */
export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
