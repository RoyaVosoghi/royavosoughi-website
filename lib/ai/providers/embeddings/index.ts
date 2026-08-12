import "server-only";

import { embedCohere, isCohereEmbeddingConfigured } from "./cohere";
import { embedGoogle, isGoogleEmbeddingConfigured } from "./google";
import { embedOpenAi, isOpenAiEmbeddingConfigured } from "./openai";
import { padEmbedding } from "./pad";
import type { EmbedOptions, EmbeddingInputType } from "./types";
import { embedVoyage, isVoyageEmbeddingConfigured } from "./voyage";

export type { EmbeddingInputType } from "./types";
export { isCohereEmbeddingConfigured, rerankCohere } from "./cohere";

export function isEmbeddingProviderConfigured(provider: string): boolean {
  switch (provider) {
    case "openai":
      return isOpenAiEmbeddingConfigured();
    case "cohere":
      return isCohereEmbeddingConfigured();
    case "voyage":
      return isVoyageEmbeddingConfigured();
    case "google":
    default:
      return isGoogleEmbeddingConfigured();
  }
}

/** Dispatches to the configured provider, then zero-pads the result to the shared vector(2000) column width — see pad.ts for why that's safe (and why 2000, not a provider's native size). Every caller (retrieval.ts, ingest.ts) goes through this instead of importing a provider directly. */
export async function embed(
  text: string,
  provider: string,
  model: string,
  dimensions: number,
  inputType: EmbeddingInputType,
): Promise<number[]> {
  const options: EmbedOptions = { inputType, dimensions, model };

  let native: number[];
  switch (provider) {
    case "openai":
      native = await embedOpenAi(text, options);
      break;
    case "cohere":
      native = await embedCohere(text, options);
      break;
    case "voyage":
      native = await embedVoyage(text, options);
      break;
    case "google":
    default:
      native = await embedGoogle(text, options);
      break;
  }

  return padEmbedding(native);
}
