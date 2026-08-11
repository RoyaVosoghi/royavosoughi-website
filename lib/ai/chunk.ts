import "server-only";

import { DEFAULT_EMBEDDING_CONFIG } from "./embedding-config";

export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: DEFAULT_EMBEDDING_CONFIG.chunkSize,
  chunkOverlap: DEFAULT_EMBEDDING_CONFIG.chunkOverlap,
};

/**
 * Paragraph-aware splitter: groups whole paragraphs up to chunkSize, hard-
 * splitting only a single paragraph that alone exceeds chunkSize. Small
 * overlap keeps context from being severed mid-thought at a chunk boundary.
 * Values come from /admin/settings (embedding_config, via
 * lib/ai/embedding-config.ts) — callers pass a config rather than this
 * module reading settings itself, so a plain unit test can still cover the
 * pure splitting logic without a database.
 */
export function chunkText(text: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): string[] {
  const { chunkSize, chunkOverlap } = config;

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
