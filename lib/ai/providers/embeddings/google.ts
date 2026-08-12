import "server-only";

import { getGeminiClient } from "../../gemini";
import type { EmbedOptions } from "./types";

/**
 * Uses the Gemini Developer API (a plain API key, same as chat used to)
 * rather than Vertex AI's text-multilingual-embedding-002 — that model is
 * Vertex-only and needs a GCP service account, a much heavier auth setup
 * than every other provider in this file. gemini-embedding-001 already
 * covers "Google, multilingual, good for Persian" without introducing a
 * second Google auth mechanism into the codebase.
 */
export function isGoogleEmbeddingConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function embedGoogle(text: string, options: EmbedOptions): Promise<number[]> {
  const ai = getGeminiClient();
  if (!ai) throw new Error("google_embedding_not_configured");

  const response = await ai.models.embedContent({
    model: options.model,
    contents: text,
    config: {
      outputDimensionality: options.dimensions,
      taskType: options.inputType === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values) throw new Error("embedding_failed");
  return values;
}
