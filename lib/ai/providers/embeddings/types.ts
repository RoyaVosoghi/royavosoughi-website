/** "document" for chunks written at ingest time, "query" for the live search embedding — Cohere and Voyage produce measurably better retrieval when told which is which; OpenAI and Google's Gemini API mostly ignore the distinction but it's harmless to pass. */
export type EmbeddingInputType = "query" | "document";

export interface EmbedOptions {
  inputType: EmbeddingInputType;
  /** Desired output dimensionality — native for most models, a Matryoshka truncation for Gemini/OpenAI's newer embedding models. */
  dimensions: number;
  model: string;
}
