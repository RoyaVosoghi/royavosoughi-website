import "server-only";

const TARGET_CHARS = 700;
const MAX_CHARS = 900;
const OVERLAP_CHARS = 120;

/**
 * Paragraph-aware splitter: groups whole paragraphs up to ~TARGET_CHARS,
 * only falling back to a hard character cut for a single paragraph that
 * exceeds MAX_CHARS on its own. Small overlap keeps context from being
 * severed mid-thought at a chunk boundary.
 */
export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= TARGET_CHARS) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = current.slice(Math.max(0, current.length - OVERLAP_CHARS));
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      current = paragraph;
    }

    while (current.length > MAX_CHARS) {
      chunks.push(current.slice(0, MAX_CHARS));
      current = current.slice(MAX_CHARS - OVERLAP_CHARS);
    }
  }

  if (current) chunks.push(current);

  return chunks;
}
