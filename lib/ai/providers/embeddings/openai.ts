import "server-only";

import type { EmbedOptions } from "./types";

const apiKey = process.env.OPENAI_API_KEY;

export function isOpenAiEmbeddingConfigured(): boolean {
  return Boolean(apiKey);
}

/** Plain fetch, not the openai SDK — the SDK instance we already have is pinned to OpenRouter's baseURL for chat; a second differently-configured client for one REST call isn't worth it. text-embedding-3-* natively supports the `dimensions` truncation param. */
export async function embedOpenAi(text: string, options: EmbedOptions): Promise<number[]> {
  if (!apiKey) throw new Error("openai_embedding_not_configured");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: options.model, input: text, dimensions: options.dimensions }),
  });

  if (!response.ok) {
    throw new Error(`openai_embedding_failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
  const values = data.data?.[0]?.embedding;
  if (!values) throw new Error("embedding_failed");
  return values;
}
