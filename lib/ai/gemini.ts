import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * Chat generation moved to OpenRouter (lib/ai/providers/openrouter.ts) —
 * this client is now embeddings-only, one of the four providers in
 * lib/ai/providers/embeddings/. Kept as its own file (not folded into that
 * directory) since it was picked specifically for Gemini's genuine
 * non-trial free API tier — see .env.local.example. Mirrors the
 * isSupabaseConfigured()/getSupabaseClient() memoized-client pattern in
 * lib/supabase.ts.
 */

const apiKey = process.env.GEMINI_API_KEY;

export const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

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
