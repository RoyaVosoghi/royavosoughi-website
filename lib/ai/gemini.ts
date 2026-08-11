import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * Gemini was picked specifically because it's the one major provider with a
 * genuine (non-trial) free API tier — see .env.local.example. Mirrors the
 * isSupabaseConfigured()/getSupabaseClient() memoized-client pattern in
 * lib/supabase.ts.
 */

const apiKey = process.env.GEMINI_API_KEY;

/**
 * "gemini-flash-latest" is a Google-maintained alias, not a pinned version —
 * it keeps pointing at a currently-supported flash model as Google retires
 * older ones (a pinned "gemini-2.5-flash" 404'd for this key: "no longer
 * available to new users"). Pin to a specific version via env var instead if
 * reproducible behavior ever matters more than staying unblocked.
 */
export const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-flash-latest";
export const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

/**
 * gemini-embedding-001 natively outputs 3072 dims; truncated to 768 via
 * outputDimensionality (Matryoshka representation — the model was trained so
 * a prefix of the full vector is itself a valid, if slightly less precise,
 * embedding). 768 keeps the HNSW index compact for a knowledge base that
 * starts as a few dozen chunks. Must match chunks.embedding's column width.
 */
export const EMBEDDING_DIMENSIONS = 768;

export function isGeminiConfigured(): boolean {
  return Boolean(apiKey);
}

let cached: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
  if (!cached) {
    cached = new GoogleGenAI({ apiKey: apiKey! });
  }
  return cached;
}
