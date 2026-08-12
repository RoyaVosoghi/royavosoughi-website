import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Singleton row (id=1) — DB-editable mirror of what used to be env-only
 * (CHAT_RATE_LIMIT_WINDOW_MINUTES/CHAT_RATE_LIMIT_MAX_MESSAGES), plus a
 * retention window for the "run cleanup now" admin action. Env vars stay as
 * the fallback when unconfigured, same pattern as every other *-config.ts.
 */
export interface SecurityConfig {
  rateLimitWindowMinutes: number;
  rateLimitMaxMessages: number;
  /** null = keep forever (no automatic cleanup). */
  retentionDays: number | null;
}

export function defaultSecurityConfig(): SecurityConfig {
  return {
    rateLimitWindowMinutes: Number(process.env.CHAT_RATE_LIMIT_WINDOW_MINUTES ?? 10),
    rateLimitMaxMessages: Number(process.env.CHAT_RATE_LIMIT_MAX_MESSAGES ?? 20),
    retentionDays: null,
  };
}

const CACHE_TTL_MS = 60_000;
let cached: { value: SecurityConfig; expiresAt: number } | null = null;

export async function getSecurityConfig(): Promise<SecurityConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return defaultSecurityConfig();

  const { data, error } = await supabase
    .from("security_config")
    .select("rate_limit_window_minutes, rate_limit_max_messages, retention_days")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[security-config] fetch failed:", error.message);
    return defaultSecurityConfig();
  }

  const value: SecurityConfig = {
    rateLimitWindowMinutes: data.rate_limit_window_minutes,
    rateLimitMaxMessages: data.rate_limit_max_messages,
    retentionDays: data.retention_days,
  };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export interface SecurityConfigUpdate {
  rateLimitWindowMinutes?: number;
  rateLimitMaxMessages?: number;
  retentionDays?: number | null;
}

export async function updateSecurityConfig(update: SecurityConfigUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.rateLimitWindowMinutes !== undefined) patch.rate_limit_window_minutes = update.rateLimitWindowMinutes;
  if (update.rateLimitMaxMessages !== undefined) patch.rate_limit_max_messages = update.rateLimitMaxMessages;
  if (update.retentionDays !== undefined) patch.retention_days = update.retentionDays;

  const { error } = await supabase.from("security_config").update(patch).eq("id", 1);
  if (error) throw error;

  cached = null;
}

export interface RetentionCleanupResult {
  conversationsDeleted: number;
  rateLimitHitsDeleted: number;
}

/** Deletes conversations (and their messages, via ON DELETE CASCADE) older than retention_days, plus stale rate_limit_hits rows past the current rate-limit window — the latter is routine housekeeping regardless of the retention setting. */
export async function runRetentionCleanup(): Promise<RetentionCleanupResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const config = await getSecurityConfig();
  let conversationsDeleted = 0;

  if (config.retentionDays !== null) {
    const cutoff = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("conversations").delete().lt("last_active_at", cutoff).select("id");
    if (error) throw error;
    conversationsDeleted = data?.length ?? 0;
  }

  const hitsCutoff = new Date(Date.now() - config.rateLimitWindowMinutes * 60_000 * 2).toISOString();
  const { data: hitsData, error: hitsError } = await supabase
    .from("rate_limit_hits")
    .delete()
    .lt("created_at", hitsCutoff)
    .select("id");
  if (hitsError) throw hitsError;

  return { conversationsDeleted, rateLimitHitsDeleted: hitsData?.length ?? 0 };
}
