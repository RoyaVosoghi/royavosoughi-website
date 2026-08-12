import "server-only";

import OpenAI from "openai";

/**
 * Every chat model in lib/ai/model-catalog.ts is called through this one
 * client — OpenRouter is OpenAI-tool-call-compatible, so Anthropic/Google/
 * OpenAI/Qwen models all go through the same request shape. Mirrors the
 * isGeminiConfigured()/getGeminiClient() memoized-client pattern this repo
 * already uses (lib/ai/gemini.ts, now embeddings-only).
 */

const apiKey = process.env.OPENROUTER_API_KEY;

export function isOpenRouterConfigured(): boolean {
  return Boolean(apiKey);
}

let cached: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI | null {
  if (!isOpenRouterConfigured()) return null;
  if (!cached) {
    cached = new OpenAI({
      apiKey: apiKey!,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        // OpenRouter uses these to attribute usage in its own dashboard —
        // optional, but free and useful for debugging which deploy called what.
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://royavosoughi.com",
        "X-Title": "Roya Vosoughi — chatbot",
      },
    });
  }
  return cached;
}

/** True for OpenRouter's rate-limit/quota response — the same "treat as our own rate limit, not a generic upstream failure" logic brain.ts had for Gemini's 429. */
export function isRateLimitError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "status" in err && (err as { status: unknown }).status === 429);
}
