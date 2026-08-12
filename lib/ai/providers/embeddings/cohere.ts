import "server-only";

import type { EmbedOptions } from "./types";

const apiKey = process.env.COHERE_API_KEY;

export function isCohereEmbeddingConfigured(): boolean {
  return Boolean(apiKey);
}

/** embed-multilingual-v3.0 outputs a fixed 1024 dims — no dimensions param to pass. input_type is required by Cohere's v2 embed API and is exactly the query/document distinction embedding_config.input_type exists for. */
export async function embedCohere(text: string, options: EmbedOptions): Promise<number[]> {
  if (!apiKey) throw new Error("cohere_embedding_not_configured");

  const response = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: options.model,
      texts: [text],
      input_type: options.inputType === "query" ? "search_query" : "search_document",
      embedding_types: ["float"],
    }),
  });

  if (!response.ok) {
    throw new Error(`cohere_embedding_failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { embeddings?: { float?: number[][] } };
  const values = data.embeddings?.float?.[0];
  if (!values) throw new Error("embedding_failed");
  return values;
}

export interface CohereRerankResult {
  index: number;
  relevanceScore: number;
}

/** Used only when embedding_config.reranker_enabled is true (see lib/ai/retrieval.ts) — re-scores the top-K chunks match_chunks already returned, using the same Cohere key as the embedding provider. */
export async function rerankCohere(
  query: string,
  documents: string[],
  model = "rerank-v3.5",
): Promise<CohereRerankResult[]> {
  if (!apiKey) throw new Error("cohere_embedding_not_configured");

  const response = await fetch("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, query, documents }),
  });

  if (!response.ok) {
    throw new Error(`cohere_rerank_failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { results?: Array<{ index: number; relevance_score: number }> };
  return (data.results ?? []).map((r) => ({ index: r.index, relevanceScore: r.relevance_score }));
}
