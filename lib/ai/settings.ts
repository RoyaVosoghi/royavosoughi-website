import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * The tunable half of the brain — chunking, retrieval and summarization
 * parameters, plus optional persona overrides — read from a singleton DB row
 * so they're editable from /admin/settings without a redeploy. Every field
 * has a hardcoded fallback (below) so the brain behaves identically to
 * before this table existed if the row is missing or Supabase is down.
 */
export interface BotSettings {
  systemPromptEn: string | null;
  systemPromptFa: string | null;
  chunkTargetChars: number;
  chunkMaxChars: number;
  chunkOverlapChars: number;
  retrievalTopK: number;
  similarityThreshold: number;
  summarizeAfterMessages: number;
}

export const DEFAULT_BOT_SETTINGS: BotSettings = {
  systemPromptEn: null,
  systemPromptFa: null,
  chunkTargetChars: 700,
  chunkMaxChars: 900,
  chunkOverlapChars: 120,
  retrievalTopK: 6,
  similarityThreshold: 0.25,
  summarizeAfterMessages: 16,
};

interface SettingsRow {
  system_prompt_en: string | null;
  system_prompt_fa: string | null;
  chunk_target_chars: number;
  chunk_max_chars: number;
  chunk_overlap_chars: number;
  retrieval_top_k: number;
  similarity_threshold: number;
  summarize_after_messages: number;
}

function fromRow(row: SettingsRow): BotSettings {
  return {
    systemPromptEn: row.system_prompt_en,
    systemPromptFa: row.system_prompt_fa,
    chunkTargetChars: row.chunk_target_chars,
    chunkMaxChars: row.chunk_max_chars,
    chunkOverlapChars: row.chunk_overlap_chars,
    retrievalTopK: row.retrieval_top_k,
    similarityThreshold: row.similarity_threshold,
    summarizeAfterMessages: row.summarize_after_messages,
  };
}

// Warm-instance cache — settings are read on every chat turn, so this avoids
// a DB round trip per message. 60s is short enough that an admin edit takes
// effect almost immediately, long enough to matter under real traffic.
const CACHE_TTL_MS = 60_000;
let cached: { value: BotSettings; expiresAt: number } | null = null;

export async function getBotSettings(): Promise<BotSettings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return DEFAULT_BOT_SETTINGS;

  const { data, error } = await supabase
    .from("bot_settings")
    .select(
      "system_prompt_en, system_prompt_fa, chunk_target_chars, chunk_max_chars, chunk_overlap_chars, retrieval_top_k, similarity_threshold, summarize_after_messages",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[settings] fetch failed:", error.message);
    return DEFAULT_BOT_SETTINGS;
  }

  const value = fromRow(data as SettingsRow);
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export interface BotSettingsUpdate {
  systemPromptEn?: string | null;
  systemPromptFa?: string | null;
  chunkTargetChars?: number;
  chunkMaxChars?: number;
  chunkOverlapChars?: number;
  retrievalTopK?: number;
  similarityThreshold?: number;
  summarizeAfterMessages?: number;
}

/** Called only from the admin settings API route. Invalidates the cache so the change is visible on the very next chat turn. */
export async function updateBotSettings(update: BotSettingsUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("systemPromptEn" in update) patch.system_prompt_en = update.systemPromptEn;
  if ("systemPromptFa" in update) patch.system_prompt_fa = update.systemPromptFa;
  if (update.chunkTargetChars !== undefined) patch.chunk_target_chars = update.chunkTargetChars;
  if (update.chunkMaxChars !== undefined) patch.chunk_max_chars = update.chunkMaxChars;
  if (update.chunkOverlapChars !== undefined) patch.chunk_overlap_chars = update.chunkOverlapChars;
  if (update.retrievalTopK !== undefined) patch.retrieval_top_k = update.retrievalTopK;
  if (update.similarityThreshold !== undefined) patch.similarity_threshold = update.similarityThreshold;
  if (update.summarizeAfterMessages !== undefined)
    patch.summarize_after_messages = update.summarizeAfterMessages;

  const { error } = await supabase.from("bot_settings").update(patch).eq("id", 1);
  if (error) throw error;

  cached = null;
}
