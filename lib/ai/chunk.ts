import "server-only";

import { DEFAULT_BOT_SETTINGS } from "./settings";

export interface ChunkConfig {
  targetChars: number;
  maxChars: number;
  overlapChars: number;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  targetChars: DEFAULT_BOT_SETTINGS.chunkTargetChars,
  maxChars: DEFAULT_BOT_SETTINGS.chunkMaxChars,
  overlapChars: DEFAULT_BOT_SETTINGS.chunkOverlapChars,
};

/**
 * Paragraph-aware splitter: groups whole paragraphs up to ~targetChars, only
 * falling back to a hard character cut for a single paragraph that exceeds
 * maxChars on its own. Small overlap keeps context from being severed
 * mid-thought at a chunk boundary. Values come from /admin/settings (via
 * lib/ai/settings.ts) — callers pass a config rather than this module
 * reading settings itself, so a plain unit test can still cover the pure
 * splitting logic without a database.
 */
export function chunkText(text: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): string[] {
  const { targetChars, maxChars, overlapChars } = config;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= targetChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = current.slice(Math.max(0, current.length - overlapChars));
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      current = paragraph;
    }

    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars - overlapChars);
    }
  }

  if (current) chunks.push(current);

  return chunks;
}
