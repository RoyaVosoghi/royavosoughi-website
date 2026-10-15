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
  /** Answer obvious prompt-injection attempts with a canned reply, no model call (lib/ai/injection-guard.ts). */
  injectionGuardEnabled: boolean;
  workingHours: WorkingHours;
}

export interface WorkingHours {
  enabled: boolean;
  /** IANA zone, e.g. "Europe/London". Never shown to visitors. */
  timezone: string;
  /** Hour of day, 0–23, inclusive. */
  start: number;
  /** Hour of day, 1–24, exclusive. */
  end: number;
  /** JS getDay() numbering: 0 = Sunday … 6 = Saturday. */
  days: number[];
}

export function defaultSecurityConfig(): SecurityConfig {
  return {
    rateLimitWindowMinutes: Number(process.env.CHAT_RATE_LIMIT_WINDOW_MINUTES ?? 10),
    rateLimitMaxMessages: Number(process.env.CHAT_RATE_LIMIT_MAX_MESSAGES ?? 20),
    retentionDays: null,
    injectionGuardEnabled: true,
    workingHours: { enabled: false, timezone: "UTC", start: 9, end: 18, days: [1, 2, 3, 4, 5] },
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
    .select("*")
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
    // `?? default` keeps this working on a database that hasn't run the
    // chat-guard ALTERs in supabase/schema.sql yet (select("*") just omits them).
    injectionGuardEnabled: data.injection_guard_enabled ?? true,
    workingHours: {
      enabled: data.working_hours_enabled ?? false,
      timezone: data.working_hours_timezone ?? "UTC",
      start: data.working_hours_start ?? 9,
      end: data.working_hours_end ?? 18,
      days: data.working_days ?? [1, 2, 3, 4, 5],
    },
  };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export interface SecurityConfigUpdate {
  rateLimitWindowMinutes?: number;
  rateLimitMaxMessages?: number;
  retentionDays?: number | null;
  injectionGuardEnabled?: boolean;
  workingHours?: WorkingHours;
}

export async function updateSecurityConfig(update: SecurityConfigUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.rateLimitWindowMinutes !== undefined) patch.rate_limit_window_minutes = update.rateLimitWindowMinutes;
  if (update.rateLimitMaxMessages !== undefined) patch.rate_limit_max_messages = update.rateLimitMaxMessages;
  if (update.retentionDays !== undefined) patch.retention_days = update.retentionDays;
  if (update.injectionGuardEnabled !== undefined) patch.injection_guard_enabled = update.injectionGuardEnabled;
  if (update.workingHours !== undefined) {
    patch.working_hours_enabled = update.workingHours.enabled;
    patch.working_hours_timezone = update.workingHours.timezone;
    patch.working_hours_start = update.workingHours.start;
    patch.working_hours_end = update.workingHours.end;
    patch.working_days = update.workingHours.days;
  }

  const { error } = await supabase.from("security_config").update(patch).eq("id", 1);
  if (error) throw error;

  cached = null;
}

/** True when `now` falls outside the configured hours (always false while the feature is off or the zone is invalid). */
export function isOutsideWorkingHours(hours: WorkingHours, now = new Date()): boolean {
  if (!hours.enabled) return false;
  let weekday: string;
  let hour: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: hours.timezone,
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
    weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    hour = Number(parts.find((p) => p.type === "hour")?.value);
  } catch {
    return false;
  }
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  if (day === -1 || Number.isNaN(hour)) return false;
  return !hours.days.includes(day) || hour < hours.start || hour >= hours.end;
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
