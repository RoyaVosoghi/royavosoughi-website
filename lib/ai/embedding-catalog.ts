/**
 * The embedding models offered in the admin panel's picker — all four are
 * multilingual and hold up well for Persian (see /admin/settings for the
 * "changing this requires a full re-embed" warning that gates switching).
 */

export type EmbeddingProviderId = "google" | "openai" | "cohere" | "voyage";

export interface EmbeddingCatalogEntry {
  provider: EmbeddingProviderId;
  model: string;
  label: string;
  /** Default/native output dimensionality. */
  dimensions: number;
  /** True for OpenAI's text-embedding-3-* — dimensions is a real Matryoshka truncation param there, editable in the UI. Fixed-size models (Cohere/Voyage) and Google's Matryoshka model default to their native/standard size instead. */
  customDimensions?: boolean;
  supportsInputType?: boolean;
}

export const EMBEDDING_CATALOG: EmbeddingCatalogEntry[] = [
  {
    provider: "cohere",
    model: "embed-multilingual-v3.0",
    label: "Cohere embed-multilingual-v3.0",
    dimensions: 1024,
    supportsInputType: true,
  },
  {
    // Native output is 3072, but pgvector's HNSW index caps at 2000
    // dimensions — text-embedding-3-large's `dimensions` API param natively
    // truncates with minimal quality loss, so 2000 is the default here (the
    // shared chunks.embedding column width), not the model's true native size.
    provider: "openai",
    model: "text-embedding-3-large",
    label: "OpenAI text-embedding-3-large",
    dimensions: 2000,
    customDimensions: true,
  },
  {
    provider: "openai",
    model: "text-embedding-3-small",
    label: "OpenAI text-embedding-3-small",
    dimensions: 1536,
    customDimensions: true,
  },
  {
    provider: "google",
    model: "gemini-embedding-001",
    label: "Google gemini-embedding-001",
    dimensions: 768,
  },
  {
    provider: "voyage",
    model: "voyage-multilingual-2",
    label: "Voyage voyage-multilingual-2",
    dimensions: 1024,
    supportsInputType: true,
  },
];

export function getEmbeddingCatalogEntry(provider: string, model: string): EmbeddingCatalogEntry | undefined {
  return EMBEDDING_CATALOG.find((e) => e.provider === provider && e.model === model);
}

export function groupedEmbeddingCatalog(): Array<{ provider: EmbeddingProviderId; models: EmbeddingCatalogEntry[] }> {
  const providers: EmbeddingProviderId[] = ["cohere", "openai", "google", "voyage"];
  return providers.map((provider) => ({
    provider,
    models: EMBEDDING_CATALOG.filter((e) => e.provider === provider),
  }));
}
