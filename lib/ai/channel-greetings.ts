import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Channel, Locale } from "./types";

/**
 * Per-(channel, locale) welcome message + quick replies, editable from
 * /admin/settings. Widget's welcome message stays on widget_config (built
 * earlier, already wired into the public /api/widget/config endpoint) — this
 * table doesn't duplicate it, it only adds quick replies for widget and both
 * welcome+quick-replies for web/Telegram, which had neither before.
 */
export interface ChannelGreeting {
  welcomeMessage: string | null;
  quickReplies: string[];
}

const EMPTY_GREETING: ChannelGreeting = { welcomeMessage: null, quickReplies: [] };

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: ChannelGreeting; expiresAt: number }>();

export async function getChannelGreeting(channel: Channel, locale: Locale): Promise<ChannelGreeting> {
  const key = `${channel}:${locale}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return EMPTY_GREETING;

  const { data, error } = await supabase
    .from("channel_greetings")
    .select("welcome_message, quick_replies")
    .eq("channel", channel)
    .eq("locale", locale)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[channel-greetings] fetch failed:", error.message);
    return EMPTY_GREETING;
  }

  const value: ChannelGreeting = { welcomeMessage: data.welcome_message, quickReplies: data.quick_replies ?? [] };
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export interface AllChannelGreetingsRow extends ChannelGreeting {
  channel: Channel;
  locale: Locale;
}

/** For the admin settings page — every (channel, locale) combination in one query, defaults filled in for rows that don't exist yet. */
export async function getAllChannelGreetings(): Promise<AllChannelGreetingsRow[]> {
  const channels: Channel[] = ["web", "telegram", "widget"];
  const locales: Locale[] = ["en", "fa"];
  const combos = channels.flatMap((channel) => locales.map((locale) => ({ channel, locale })));

  const supabase = getSupabaseAdminClient();
  if (!supabase) return combos.map((c) => ({ ...c, ...EMPTY_GREETING }));

  const { data, error } = await supabase.from("channel_greetings").select("channel, locale, welcome_message, quick_replies");
  if (error) {
    console.error("[channel-greetings] fetch-all failed:", error.message);
    return combos.map((c) => ({ ...c, ...EMPTY_GREETING }));
  }

  const map = new Map<string, ChannelGreeting>();
  for (const row of (data ?? []) as Array<{ channel: Channel; locale: Locale; welcome_message: string | null; quick_replies: string[] }>) {
    map.set(`${row.channel}:${row.locale}`, { welcomeMessage: row.welcome_message, quickReplies: row.quick_replies ?? [] });
  }

  return combos.map((c) => ({ ...c, ...(map.get(`${c.channel}:${c.locale}`) ?? EMPTY_GREETING) }));
}

export async function updateChannelGreeting(
  channel: Channel,
  locale: Locale,
  update: { welcomeMessage?: string | null; quickReplies?: string[] },
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { channel, locale, updated_at: new Date().toISOString() };
  if (update.welcomeMessage !== undefined) patch.welcome_message = update.welcomeMessage;
  if (update.quickReplies !== undefined) patch.quick_replies = update.quickReplies;

  const { error } = await supabase.from("channel_greetings").upsert(patch, { onConflict: "channel,locale" });
  if (error) throw error;

  cache.delete(`${channel}:${locale}`);
}
