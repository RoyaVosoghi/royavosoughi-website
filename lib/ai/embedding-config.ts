import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Singleton row (id=1) — retrieval + chunking knobs, editable from
 * /admin/settings. provider/model/dimensions are shown with an explicit
 * "changing this requires a full re-embed" confirm flow in the UI (see
 * components/admin/EmbeddingConfigForm.tsx + the rebuild action at
 * app/api/admin/embedding-config/rebuild/route.ts): switching invalidates
 * every vector already stored in `chunks`, since a document's chunks can
 * only be compared against a query embedded by the SAME model.
 */
export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimensions: number;
  /** Cohere/Voyage distinguish "this text will be searched for" vs. "this text will be searched against" — null for providers that don't (OpenAI, Google). */
  inputType: string | null;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  rerankerEnabled: boolean;
  rerankerModel: string | null;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: "google",
  model: "gemini-embedding-001",
  dimensions: 768,
  inputType: null,
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
      "provider, model, dimensions, input_type, chunk_size, chunk_overlap, top_k, similarity_threshold, reranker_enabled, reranker_model",
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
    inputType: data.input_type,
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
  provider?: string;
  model?: string;
  dimensions?: number;
  inputType?: string | null;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  similarityThreshold?: number;
  rerankerEnabled?: boolean;
  rerankerModel?: string | null;
}

export async function updateEmbeddingConfig(update: EmbeddingConfigUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.provider !== undefined) patch.provider = update.provider;
  if (update.model !== undefined) patch.model = update.model;
  if (update.dimensions !== undefined) patch.dimensions = update.dimensions;
  if (update.inputType !== undefined) patch.input_type = update.inputType;
  if (update.chunkSize !== undefined) patch.chunk_size = update.chunkSize;
  if (update.chunkOverlap !== undefined) patch.chunk_overlap = update.chunkOverlap;
  if (update.topK !== undefined) patch.top_k = update.topK;
  if (update.similarityThreshold !== undefined) patch.similarity_threshold = update.similarityThreshold;
  if (update.rerankerEnabled !== undefined) patch.reranker_enabled = update.rerankerEnabled;
  if (update.rerankerModel !== undefined) patch.reranker_model = update.rerankerModel;

  const { error } = await supabase.from("embedding_config").update(patch).eq("id", 1);
  if (error) throw error;

  cached = null;
}
