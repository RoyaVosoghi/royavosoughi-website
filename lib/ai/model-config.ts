import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { MODEL_CATALOG } from "./model-catalog";
import type { Channel } from "./types";

/**
 * One row per channel — which model + generation params to use, editable
 * from /admin/settings. Every model in model-catalog.ts is an OpenRouter
 * slug, so `provider` is always 'openrouter' here — kept as a column (not
 * hardcoded) only so a future non-OpenRouter provider isn't a schema change.
 * `schedule` (day-of-week → model override) and `fallback_model` (used on a
 * provider error/429) are both evaluated at call time by
 * resolveEffectiveModel() below.
 */
export interface ModelConfig {
  provider: string;
  activeModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  fallbackModel: string | null;
  schedule: WeekdaySchedule | null;
}

/** Keys are JS Date#getDay() (0=Sunday..6=Saturday) as strings, so lookups don't need a day-name table. Value is an OpenRouter slug that overrides activeModel for that day; a day with no key uses activeModel as usual. */
export type WeekdaySchedule = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", string>>;

const DEFAULT_MODEL = MODEL_CATALOG[0].slug;

export function defaultModelConfig(): ModelConfig {
  return {
    provider: "openrouter",
    activeModel: DEFAULT_MODEL,
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.95,
    fallbackModel: null,
    schedule: null,
  };
}

/** Today's scheduled override, if any — otherwise activeModel. Pure function of (config, now) so it's trivially testable and the admin UI can preview "what runs today" without a network call. */
export function resolveScheduledModel(config: ModelConfig, now: Date = new Date()): string {
  if (!config.schedule) return config.activeModel;
  const key = String(now.getDay()) as keyof WeekdaySchedule;
  return config.schedule[key] || config.activeModel;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<Channel, { value: ModelConfig; expiresAt: number }>();

export async function getModelConfig(channel: Channel): Promise<ModelConfig> {
  const hit = cache.get(channel);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return defaultModelConfig();

  const { data, error } = await supabase
    .from("model_config")
    .select("provider, active_model, temperature, max_tokens, top_p, fallback_model, schedule")
    .eq("channel", channel)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[model-config] fetch failed:", error.message);
    return defaultModelConfig();
  }

  const value: ModelConfig = {
    provider: data.provider,
    activeModel: data.active_model,
    temperature: data.temperature,
    maxTokens: data.max_tokens,
    topP: data.top_p,
    fallbackModel: data.fallback_model,
    schedule: (data.schedule as WeekdaySchedule) ?? null,
  };
  cache.set(channel, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export interface ModelConfigUpdate {
  activeModel?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  fallbackModel?: string | null;
  schedule?: WeekdaySchedule | null;
}

/**
 * `provider` is only written when the caller explicitly passes it — never
 * defaulted to "openrouter" here. This used to be hardcoded on every save,
 * which silently flipped a channel set to a non-OpenRouter provider (e.g.
 * 'gemini') back to 'openrouter' the next time anyone touched any other
 * setting (temperature, fallback, ...) from the admin panel. The admin
 * UI's model picker currently only offers OpenRouter catalog slugs, so in
 * practice this just means: don't touch the provider column unless asked to.
 */
export async function updateModelConfig(channel: Channel, update: ModelConfigUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.provider !== undefined) patch.provider = update.provider;
  if (update.activeModel !== undefined) patch.active_model = update.activeModel;
  if (update.temperature !== undefined) patch.temperature = update.temperature;
  if (update.maxTokens !== undefined) patch.max_tokens = update.maxTokens;
  if (update.topP !== undefined) patch.top_p = update.topP;
  if (update.fallbackModel !== undefined) patch.fallback_model = update.fallbackModel;
  if (update.schedule !== undefined) patch.schedule = update.schedule;

  const { error } = await supabase.from("model_config").update(patch).eq("channel", channel);
  if (error) throw error;

  cache.delete(channel);
}

/** For the admin settings page — all three channels' config in one query. */
export async function getAllModelConfigs(): Promise<Array<{ channel: Channel } & ModelConfig>> {
  const channels: Channel[] = ["web", "telegram", "widget"];
  const supabase = getSupabaseAdminClient();
  if (!supabase) return channels.map((channel) => ({ channel, ...defaultModelConfig() }));

  const { data, error } = await supabase
    .from("model_config")
    .select("channel, provider, active_model, temperature, max_tokens, top_p, fallback_model, schedule")
    .order("channel");

  if (error || !data) {
    if (error) console.error("[model-config] fetch-all failed:", error.message);
    return channels.map((channel) => ({ channel, ...defaultModelConfig() }));
  }

  return data.map((row) => ({
    channel: row.channel as Channel,
    provider: row.provider,
    activeModel: row.active_model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    topP: row.top_p,
    fallbackModel: row.fallback_model,
    schedule: (row.schedule as WeekdaySchedule) ?? null,
  }));
}
