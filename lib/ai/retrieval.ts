import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEmbeddingConfig } from "./embedding-config";
import { embed, isCohereEmbeddingConfigured, rerankCohere } from "./providers/embeddings";
import type { EmbeddingInputType } from "./providers/embeddings";
import type { Locale } from "./types";

export { isEmbeddingProviderConfigured } from "./providers/embeddings";

/** Embeds against whatever provider/model embedding_config currently points at — the one place every caller (ingest, retrieval, the admin test-search box, the playground) goes through, so a provider switch takes effect everywhere at once. */
export async function embedText(text: string, inputType: EmbeddingInputType = "query"): Promise<number[]> {
  const config = await getEmbeddingConfig();
  return embed(text, config.provider, config.model, config.dimensions, inputType);
}

export interface RetrievedChunk {
  id: string;
  content: string;
  documentTitle: string;
  similarity: number;
}

/**
 * top_k and the similarity floor come from /admin/settings (embedding_config)
 * by default — pass an override only when a caller needs to deviate (the
 * admin test-search box and playground do). Returns [] on any failure
 * (misconfiguration, RPC error, or every match falling below the threshold)
 * — RAG context is an enhancement, never a hard dependency for the brain to
 * respond.
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
    embedding = await embed(query, embeddingConfig.provider, embeddingConfig.model, embeddingConfig.dimensions, "query");
  } catch (err) {
    console.error("[retrieval] embed failed:", err);
    return [];
  }

  // Overfetch when reranking so the reranker has a real candidate pool to
  // reorder, not just the same k results back.
  const fetchCount = embeddingConfig.rerankerEnabled ? Math.max(k * 3, k + 10) : k;

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_locale: locale,
    match_count: fetchCount,
  });

  if (error) {
    console.error("[retrieval] match_chunks failed:", error.message);
    return [];
  }

  let results = (
    (data ?? []) as Array<{
      id: string;
      content: string;
      document_title: string;
      similarity: number;
    }>
  ).map((row) => ({
    id: row.id,
    content: row.content,
    documentTitle: row.document_title,
    similarity: row.similarity,
  }));

  if (embeddingConfig.rerankerEnabled && isCohereEmbeddingConfigured() && results.length > 0) {
    try {
      const reranked = await rerankCohere(
        query,
        results.map((r) => r.content),
        embeddingConfig.rerankerModel || undefined,
      );
      results = reranked
        .map((r) => ({ ...results[r.index], similarity: r.relevanceScore }))
        .filter((r): r is RetrievedChunk => Boolean(r.id));
    } catch (err) {
      console.error("[retrieval] rerank failed, using vector order:", err);
    }
  }

  return results.filter((row) => row.similarity >= threshold).slice(0, k);
}
