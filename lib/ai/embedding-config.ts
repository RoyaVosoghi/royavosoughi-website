import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Singleton row (id=1) — retrieval + chunking knobs, editable from
 * /admin/settings. provider/model/dimensions are read-only in the panel:
 * changing the embedding model would invalidate every vector already stored
 * in `chunks`, so that's a re-ingest-from-scratch decision, not a live edit.
 */
export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  /** Stored but not implemented — no reranking step runs today. */
  rerankerEnabled: boolean;
  rerankerModel: string | null;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: "gemini",
  model: "gemini-embedding-001",
  dimensions: 768,
  chunkSize: 700,
  chunkOverlap: 120,
  topK: 6,
  similarityThreshold: 0.25,
  rerankerEnabled: false,
  rerankerModel: null,
};

const CACHE_TTL_MS = 60_000;
let cached: { value: EmbeddingConfig; expiresAt: number } | null = null;

export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return DEFAULT_EMBEDDING_CONFIG;

  const { data, error } = await supabase
    .from("embedding_config")
    .select(
      "provider, model, dimensions, chunk_size, chunk_overlap, top_k, similarity_threshold, reranker_enabled, reranker_model",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[embedding-config] fetch failed:", error.message);
    return DEFAULT_EMBEDDING_CONFIG;
  }

  const value: EmbeddingConfig = {
    provider: data.provider,
    model: data.model,
    dimensions: data.dimensions,
    chunkSize: data.chunk_size,
    chunkOverlap: data.chunk_overlap,
    topK: data.top_k,
    similarityThreshold: data.similarity_threshold,
    rerankerEnabled: data.reranker_enabled,
    rerankerModel: data.reranker_model,
  };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export interface EmbeddingConfigUpdate {
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  similarityThreshold?: number;
}

export async function updateEmbeddingConfig(update: EmbeddingConfigUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.chunkSize !== undefined) patch.chunk_size = update.chunkSize;
  if (update.chunkOverlap !== undefined) patch.chunk_overlap = update.chunkOverlap;
  if (update.topK !== undefined) patch.top_k = update.topK;
  if (update.similarityThreshold !== undefined) patch.similarity_threshold = update.similarityThreshold;

  const { error } = await supabase.from("embedding_config").update(patch).eq("id", 1);
  if (error) throw error;

  cached = null;
}
