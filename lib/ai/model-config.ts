import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { GEMINI_CHAT_MODEL } from "./gemini";
import type { Channel } from "./types";

/**
 * One row per channel — which model + generation params to use, editable
 * from /admin/settings. provider is fixed to 'gemini' (see
 * [[chatbot-architecture]] for why); fallback_provider/fallback_model/
 * schedule are stored but NOT evaluated at runtime — no automatic
 * provider fallback or time-based model switching happens today.
 */
export interface ModelConfig {
  provider: string;
  activeModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

export function defaultModelConfig(): ModelConfig {
  return {
    provider: "gemini",
    activeModel: GEMINI_CHAT_MODEL,
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.95,
  };
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
    .select("provider, active_model, temperature, max_tokens, top_p")
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
  };
  cache.set(channel, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export interface ModelConfigUpdate {
  activeModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export async function updateModelConfig(channel: Channel, update: ModelConfigUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.activeModel !== undefined) patch.active_model = update.activeModel;
  if (update.temperature !== undefined) patch.temperature = update.temperature;
  if (update.maxTokens !== undefined) patch.max_tokens = update.maxTokens;
  if (update.topP !== undefined) patch.top_p = update.topP;

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
    .select("channel, provider, active_model, temperature, max_tokens, top_p")
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
  }));
}
