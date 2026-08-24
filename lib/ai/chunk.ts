import "server-only";

import { DEFAULT_EMBEDDING_CONFIG } from "./embedding-config";

export type ChunkingStrategy = "paragraph" | "fixed";

export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
  strategy?: ChunkingStrategy;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: DEFAULT_EMBEDDING_CONFIG.chunkSize,
  chunkOverlap: DEFAULT_EMBEDDING_CONFIG.chunkOverlap,
  strategy: DEFAULT_EMBEDDING_CONFIG.chunkingStrategy,
};

/**
 * Paragraph-aware splitter: groups whole paragraphs up to chunkSize, hard-
 * splitting only a single paragraph that alone exceeds chunkSize. Small
 * overlap keeps context from being severed mid-thought at a chunk boundary.
 * The right default for prose (site copy, brand docs) where paragraph
 * boundaries are meaningful.
 */
function chunkTextParagraph(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = current.slice(Math.max(0, current.length - chunkOverlap));
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      current = paragraph;
    }

    while (current.length > chunkSize) {
      chunks.push(current.slice(0, chunkSize));
      current = current.slice(chunkSize - chunkOverlap);
    }
  }

  if (current) chunks.push(current);

  return chunks;
}

/**
 * Fixed-size splitter: ignores paragraph/sentence structure entirely and
 * hard-slices every chunkSize characters with chunkOverlap carried into the
 * next slice. Better fit than the paragraph strategy for source material
 * with no real paragraph structure (dense PDFs, tables-as-text, transcripts)
 * where paragraph-aware grouping just produces one giant "paragraph" chunk.
 */
function chunkTextFixed(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks: string[] = [];
  let start = 0;
  const step = Math.max(1, chunkSize - chunkOverlap);

  while (start < trimmed.length) {
    chunks.push(trimmed.slice(start, start + chunkSize));
    start += step;
  }

  return chunks;
}

/**
 * Values come from /admin/settings (embedding_config, via
 * lib/ai/embedding-config.ts) — callers pass a config rather than this
 * module reading settings itself, so a plain unit test can still cover the
 * pure splitting logic without a database.
 */
export function chunkText(text: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): string[] {
  const { chunkSize, chunkOverlap, strategy = "paragraph" } = config;
  return strategy === "fixed"
    ? chunkTextFixed(text, chunkSize, chunkOverlap)
    : chunkTextParagraph(text, chunkSize, chunkOverlap);
}
