/**
 * The chat models offered in the admin panel's model picker. Two genuinely
 * different call paths hide behind one dropdown:
 *
 * - `provider: "gemini"` — called directly via Roya's own Gemini API key
 *   (lib/ai/gemini.ts + the native streamBrainTurnGemini path in brain.ts),
 *   billed on her own Google AI Studio account. Confirmed paid/standard
 *   tier, not the free tier — see the Gemini entries' descriptions.
 * - `provider: "openrouter"` — everything else, routed through OpenRouter
 *   (lib/ai/providers/openrouter.ts), billed against OpenRouter credits
 *   (currently $0 there, so only the ":free" slugs actually work — see
 *   their descriptions). Slugs follow OpenRouter's "<vendor>/<model>"
 *   convention.
 *
 * `provider` is what brain.ts branches on to decide which client/streaming
 * API to call — it MUST be set correctly whenever `activeModel` changes, or
 * the wrong client gets called with a slug it doesn't understand. The admin
 * UI (ModelConfigForm.tsx) derives it automatically from whichever catalog
 * entry gets picked, rather than exposing it as a separate control.
 *
 * Pricing is a rough estimate for the dashboard's cost-by-model chart, not
 * pulled live from either provider — good enough for a trend line, not a
 * bill. Gemini entries are priced $0 here not because they're free, but
 * because Roya's billing happens entirely on her Google Cloud account —
 * this dashboard has no visibility into it, so $0 means "not tracked here,"
 * not "free." Some of the OpenRouter slugs (gpt-5.x, qwen-3.5) may not
 * exist there yet depending on when this runs; if a slug 404s, set
 * model_config.fallback_model to a known-good one.
 */

export type ModelProviderGroup = "gemini" | "anthropic" | "google" | "openai" | "qwen";

export interface ModelCatalogEntry {
  slug: string;
  label: string;
  /** Which client/streaming API brain.ts must use for this slug — see the module docstring. */
  provider: "gemini" | "openrouter";
  providerGroup: ModelProviderGroup;
  description: string;
  /** USD per 1M tokens, rough estimate. Gemini entries are 0 — see module docstring, this does not mean free. */
  pricePerMInputUsd: number;
  pricePerMOutputUsd: number;
}

export const PROVIDER_GROUP_LABELS: Record<ModelProviderGroup, string> = {
  gemini: "Gemini — your subscription",
  anthropic: "Anthropic (Claude) — via OpenRouter",
  google: "Google (Gemini) — via OpenRouter",
  openai: "OpenAI — via OpenRouter",
  qwen: "Qwen (Alibaba) — via OpenRouter",
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    slug: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    provider: "gemini",
    providerGroup: "gemini",
    description:
      "Called directly with Roya's own Gemini API key, on her paid Google AI Studio project (confirmed standard service tier, not free-tier). Current default for all three channels — fast, reliable, no leaked reasoning even on jailbreak-phrased prompts.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
  {
    slug: "gemini-flash-latest",
    label: "Gemini Flash (rolling alias)",
    provider: "gemini",
    providerGroup: "gemini",
    description:
      "Google's rolling alias for its current default Flash model — Google can repoint this to a newer model over time without a code or config change here. Current fallback_model for all three channels.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
  {
    slug: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    provider: "gemini",
    providerGroup: "gemini",
    description: "Newer than the 3.6 default above — confirmed available on Roya's key, not yet used in production here.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
  {
    slug: "gemini-flash-lite-latest",
    label: "Gemini Flash-Lite (rolling alias)",
    provider: "gemini",
    providerGroup: "gemini",
    description: "Cheaper/faster than Flash, somewhat less capable — a reasonable pick for the widget channel if replies feel slow.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
  {
    slug: "gemini-pro-latest",
    label: "Gemini Pro (rolling alias)",
    provider: "gemini",
    providerGroup: "gemini",
    description: "More capable and slower than Flash — worth trying if a channel needs noticeably better reasoning, at higher token cost on Roya's Google Cloud bill.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
  {
    slug: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "openrouter",
    providerGroup: "anthropic",
    description: "Fast, low-cost, very polite/human tone — good default for customer support. Needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 1,
    pricePerMOutputUsd: 5,
  },
  {
    slug: "google/gemini-3-flash",
    label: "Gemini 3 Flash",
    provider: "openrouter",
    providerGroup: "google",
    description: "Fast, very cheap, huge context window — great for RAG. Routed through OpenRouter, not Roya's own key; needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 0.15,
    pricePerMOutputUsd: 0.6,
  },
  {
    slug: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    provider: "openrouter",
    providerGroup: "google",
    description: "Even cheaper/faster than 3 Flash, slightly less capable. Needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 0.08,
    pricePerMOutputUsd: 0.3,
  },
  {
    slug: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "openrouter",
    providerGroup: "google",
    description: "Still available — the previous default, a safe fallback choice. Needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 0.15,
    pricePerMOutputUsd: 0.6,
  },
  {
    slug: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    provider: "openrouter",
    providerGroup: "openai",
    description: "Cheap, fast, good grasp of Persian idiom and natural tone. Needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 0.25,
    pricePerMOutputUsd: 1,
  },
  {
    slug: "openai/gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    provider: "openrouter",
    providerGroup: "openai",
    description: "The cheapest/fastest OpenAI option in this catalog. Needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 0.05,
    pricePerMOutputUsd: 0.2,
  },
  {
    slug: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "openrouter",
    providerGroup: "openai",
    description: "Kept for compatibility if a newer OpenAI slug isn't available yet. Needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 0.15,
    pricePerMOutputUsd: 0.6,
  },
  {
    slug: "qwen/qwen-3.5",
    label: "Qwen 3.5",
    provider: "openrouter",
    providerGroup: "qwen",
    description: "Strong multilingual, very cheap, open-weight — hosted close to Iranian users. Needs OpenRouter credits (currently $0 there).",
    pricePerMInputUsd: 0.1,
    pricePerMOutputUsd: 0.3,
  },
  {
    slug: "z-ai/glm-5.2:free",
    label: "GLM 5.2 (Free)",
    provider: "openrouter",
    providerGroup: "openai",
    description:
      "$0 via OpenRouter's free tier — confirmed tool-calling support and reliably follows the no-exposed-reasoning / plain-text rules in the system prompt. Was the default before switching to Roya's own Gemini key; still fully wired if ever needed again. OpenRouter's free lineup rotates; if this slug 404s, check openrouter.ai/api/v1/models for a current :free replacement with tool support.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
  {
    slug: "dots-studio/dots-3-note-preview:free",
    label: "Dots 3 Note Preview (Free)",
    provider: "openrouter",
    providerGroup: "openai",
    description:
      "$0 via OpenRouter's free tier, 512k context — was the fallback_model before switching to Gemini. Verified clean (no leaked reasoning) on prompts that broke earlier free models.",
    pricePerMInputUsd: 0,
    pricePerMOutputUsd: 0,
  },
];

export function getModelCatalogEntry(slug: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.slug === slug);
}

export function groupedModelCatalog(): Array<{ group: ModelProviderGroup; label: string; models: ModelCatalogEntry[] }> {
  const groups: ModelProviderGroup[] = ["gemini", "anthropic", "google", "openai", "qwen"];
  return groups.map((group) => ({
    group,
    label: PROVIDER_GROUP_LABELS[group],
    models: MODEL_CATALOG.filter((m) => m.providerGroup === group),
  }));
}

/** Rough cost estimate in USD for one call, given token counts and a catalog slug. Falls back to $0 for an unknown slug (still shows token counts, just no $ figure) rather than guessing — same as a Gemini entry, whose $0 means "billed on Roya's own Google account, not tracked here," not "free." */
export function estimateCostUsd(slug: string, tokensIn: number, tokensOut: number): number {
  const entry = getModelCatalogEntry(slug);
  if (!entry) return 0;
  return (tokensIn / 1_000_000) * entry.pricePerMInputUsd + (tokensOut / 1_000_000) * entry.pricePerMOutputUsd;
}
