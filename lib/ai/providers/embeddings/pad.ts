/**
 * chunks.embedding is a single fixed-width vector(2000) column shared by
 * every embedding provider (see supabase/schema.sql V3). 2000, not the
 * catalog's largest native size (OpenAI text-embedding-3-large's 3072) —
 * pgvector enforces a hard 2000-dimension ceiling on HNSW indexes, so
 * text-embedding-3-large is configured to truncate to <=2000 via its native
 * `dimensions` API param (lib/ai/embedding-catalog.ts) instead. Every
 * shorter provider's output is zero-padded up to 2000 before storage.
 * Zero-padding doesn't change cosine similarity (it adds 0 to the dot
 * product and doesn't change the vector's norm), so this is safe as long as
 * two vectors from *different* models are never compared — which holds here
 * because switching embedding_config.provider/model always requires a full
 * re-embed (enforced by the admin UI).
 */
export const MAX_EMBEDDING_DIMENSIONS = 2000;

export function padEmbedding(vector: number[], targetDims: number = MAX_EMBEDDING_DIMENSIONS): number[] {
  if (vector.length > targetDims) {
    throw new Error(`embedding_too_large: got ${vector.length} dims, max is ${targetDims}`);
  }
  if (vector.length === targetDims) return vector;
  return vector.concat(new Array(targetDims - vector.length).fill(0));
}
