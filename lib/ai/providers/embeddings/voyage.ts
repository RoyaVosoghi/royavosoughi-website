import "server-only";

import type { EmbedOptions } from "./types";

const apiKey = process.env.VOYAGE_API_KEY;

export function isVoyageEmbeddingConfigured(): boolean {
  return Boolean(apiKey);
}

export async function embedVoyage(text: string, options: EmbedOptions): Promise<number[]> {
  if (!apiKey) throw new Error("voyage_embedding_not_configured");

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: options.model,
      input: [text],
      input_type: options.inputType === "query" ? "query" : "document",
    }),
  });

  if (!response.ok) {
    throw new Error(`voyage_embedding_failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
  const values = data.data?.[0]?.embedding;
  if (!values) throw new Error("embedding_failed");
  return values;
}
