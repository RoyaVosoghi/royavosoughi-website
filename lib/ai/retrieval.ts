import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEmbeddingConfig } from "./embedding-config";
import { EMBEDDING_DIMENSIONS, GEMINI_EMBED_MODEL, getGeminiClient } from "./gemini";
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
  id: string;
  content: string;
  documentTitle: string;
  similarity: number;
}

/**
 * top_k and the similarity floor come from /admin/settings (embedding_config)
 * by default — pass an override only when a caller needs to deviate (nothing
 * does today). Returns [] on any failure (misconfiguration, RPC error, or
 * every match falling below the threshold) — RAG context is an enhancement,
 * never a hard dependency for the brain to respond.
 */
export async function retrieveContext(
  query: string,
  locale: Locale,
  override?: { k?: number; similarityThreshold?: number },
): Promise<RetrievedChunk[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const embeddingConfig = await getEmbeddingConfig();
  const k = override?.k ?? embeddingConfig.topK;
  const threshold = override?.similarityThreshold ?? embeddingConfig.similarityThreshold;

  let embedding: number[];
  try {
    embedding = await embedText(query);
  } catch (err) {
    console.error("[retrieval] embedText failed:", err);
    return [];
  }

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_locale: locale,
    match_count: k,
  });

  if (error) {
    console.error("[retrieval] match_chunks failed:", error.message);
    return [];
  }

  return (
    (data ?? []) as Array<{
      id: string;
      content: string;
      document_title: string;
      similarity: number;
    }>
  )
    .filter((row) => row.similarity >= threshold)
    .map((row) => ({
      id: row.id,
      content: row.content,
      documentTitle: row.document_title,
      similarity: row.similarity,
    }));
}
