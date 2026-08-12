/**
 * The chat models offered in the admin panel's model picker — every one of
 * them is called through OpenRouter (lib/ai/providers/openrouter.ts), so
 * switching the active model is just changing which slug model_config
 * points at, never a code change. Slugs follow OpenRouter's
 * "<provider>/<model>" convention.
 *
 * Pricing is a rough estimate for the dashboard's cost-by-model chart, not
 * pulled live from OpenRouter — good enough for a trend line, not a bill.
 * Some of the newer slugs here (gemini-3.x, gpt-5.x, qwen-3.5) may not exist
 * on OpenRouter yet depending on when this runs; if a slug 404s, set
 * model_config.fallback_model to a known-good one (e.g.
 * google/gemini-2.5-flash) so the brain keeps answering.
 */

export type ModelProviderGroup = "anthropic" | "google" | "openai" | "qwen";

export interface ModelCatalogEntry {
  slug: string;
  label: string;
  providerGroup: ModelProviderGroup;
  description: string;
  /** USD per 1M tokens, rough estimate. */
  pricePerMInputUsd: number;
  pricePerMOutputUsd: number;
}

export const PROVIDER_GROUP_LABELS: Record<ModelProviderGroup, string> = {
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  openai: "OpenAI",
  qwen: "Qwen (Alibaba)",
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    slug: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    providerGroup: "anthropic",
    description: "Fast, low-cost, very polite/human tone — good default for customer support.",
    pricePerMInputUsd: 1,
    pricePerMOutputUsd: 5,
  },
  {
    slug: "google/gemini-3-flash",
    label: "Gemini 3 Flash",
    providerGroup: "google",
    description: "Fast, very cheap, huge context window — great for RAG.",
    pricePerMInputUsd: 0.15,
    pricePerMOutputUsd: 0.6,
  },
  {
    slug: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    providerGroup: "google",
    description: "Even cheaper/faster than 3 Flash, slightly less capable.",
    pricePerMInputUsd: 0.08,
    pricePerMOutputUsd: 0.3,
  },
  {
    slug: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    providerGroup: "google",
    description: "Still available — the previous default, a safe fallback choice.",
    pricePerMInputUsd: 0.15,
    pricePerMOutputUsd: 0.6,
  },
  {
    slug: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    providerGroup: "openai",
    description: "Cheap, fast, good grasp of Persian idiom and natural tone.",
    pricePerMInputUsd: 0.25,
    pricePerMOutputUsd: 1,
  },
  {
    slug: "openai/gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    providerGroup: "openai",
    description: "The cheapest/fastest OpenAI option in this catalog.",
    pricePerMInputUsd: 0.05,
    pricePerMOutputUsd: 0.2,
  },
  {
    slug: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    providerGroup: "openai",
    description: "Kept for compatibility if a newer OpenAI slug isn't available yet.",
    pricePerMInputUsd: 0.15,
    pricePerMOutputUsd: 0.6,
  },
  {
    slug: "qwen/qwen-3.5",
    label: "Qwen 3.5",
    providerGroup: "qwen",
    description: "Strong multilingual, very cheap, open-weight — hosted close to Iranian users.",
    pricePerMInputUsd: 0.1,
    pricePerMOutputUsd: 0.3,
  },
  {
    slug: "openai/gpt-oss-20b:free",
    label: "GPT-OSS 20B (Free)",
    providerGroup: "openai",
    description:
      "$0 via OpenRouter's free tier — confirmed tool-calling support, so lead capture/handoff still work. Rate-limited (~20 req/min, 50/day), for testing the pipeline only. OpenRouter's free lineup rotates; if this slug 404s, swap it for another :free model at openrouter.ai/models.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
];

export function getModelCatalogEntry(slug: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.slug === slug);
}

export function groupedModelCatalog(): Array<{ group: ModelProviderGroup; label: string; models: ModelCatalogEntry[] }> {
  const groups: ModelProviderGroup[] = ["anthropic", "google", "openai", "qwen"];
  return groups.map((group) => ({
    group,
    label: PROVIDER_GROUP_LABELS[group],
    models: MODEL_CATALOG.filter((m) => m.providerGroup === group),
  }));
}

/** Rough cost estimate in USD for one call, given token counts and a catalog slug. Falls back to $0 for an unknown slug (still shows token counts, just no $ figure) rather than guessing. */
export function estimateCostUsd(slug: string, tokensIn: number, tokensOut: number): number {
  const entry = getModelCatalogEntry(slug);
  if (!entry) return 0;
  return (tokensIn / 1_000_000) * entry.pricePerMInputUsd + (tokensOut / 1_000_000) * entry.pricePerMOutputUsd;
}
