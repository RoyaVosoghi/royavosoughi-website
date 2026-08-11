import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { EMBEDDING_DIMENSIONS, GEMINI_EMBED_MODEL, getGeminiClient } from "./gemini";
import { getBotSettings } from "./settings";
import type { Locale } from "./types";

export async function embedText(text: string): Promise<number[]> {
  const ai = getGeminiClient();
  if (!ai) throw new Error("gemini_not_configured");

  const response = await ai.models.embedContent({
    model: GEMINI_EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values) throw new Error("embedding_failed");
  return values;
}

export interface RetrievedChunk {
  content: string;
  sourceKey: string;
  similarity: number;
}

/**
 * top_k and the similarity floor come from /admin/settings by default — pass
 * an override only when a caller needs to deviate (nothing does today).
 * Returns [] on any failure (misconfiguration, RPC error, or every match
 * falling below the threshold) — RAG context is an enhancement, not a hard
 * dependency for the brain to respond.
 */
export async function retrieveContext(
  query: string,
  locale: Locale,
  override?: { k?: number; similarityThreshold?: number },
): Promise<RetrievedChunk[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const settings = await getBotSettings();
  const k = override?.k ?? settings.retrievalTopK;
  const threshold = override?.similarityThreshold ?? settings.similarityThreshold;

  let embedding: number[];
  try {
    embedding = await embedText(query);
  } catch (err) {
    console.error("[retrieval] embedText failed:", err);
    return [];
  }

  const { data, error } = await supabase.rpc("match_kb_chunks", {
    query_embedding: embedding,
    match_locale: locale,
    match_count: k,
  });

  if (error) {
    console.error("[retrieval] match_kb_chunks failed:", error.message);
    return [];
  }

  return ((data ?? []) as Array<{ content: string; source_key: string; similarity: number }>)
    .filter((row) => row.similarity >= threshold)
    .map((row) => ({
      content: row.content,
      sourceKey: row.source_key,
      similarity: row.similarity,
    }));
}
