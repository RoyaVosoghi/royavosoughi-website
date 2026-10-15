import { localizeDigits, type DocLocale } from "./format";

/**
 * A document (proposal or contract) is a flat list of these blocks. The A4
 * engine (components/docs/A4Document.tsx) breaks lists and tables into
 * per-item "atoms" so they can split across pages, measures every atom, then
 * lays them out page by page — the blocks themselves know nothing about pages.
 *
 * Inline text supports **bold**; emails, URLs, IPs and phone numbers are
 * wrapped in an LTR span by the renderer so they don't scramble inside RTL text.
 */
export type DocBlock =
  | { type: "title"; text: string; subtitle?: string }
  | { type: "heading"; text: string; level?: 1 | 2 }
  | { type: "paragraph"; text: string; muted?: boolean }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; head: string[]; rows: string[][]; widths?: string[] }
  | { type: "facts"; items: Array<{ label: string; value: string }> }
  | {
      type: "card";
      title: string;
      subtitle?: string;
      price?: string;
      badge?: string;
      highlight?: boolean;
      items?: string[];
      notes?: string[];
    }
  | {
      type: "signature";
      parties: Array<{ role: string; name: string; lines: string[]; signed: boolean }>;
    };

export interface DocMeta {
  locale: DocLocale;
  /** "Proposal" / "Contract" — shown in the page header. */
  kindLabel: string;
  docNo: string;
}

/**
 * Minimal Markdown → blocks for contract bodies. Supported: `# ` title-level
 * heading, `## ` article heading (auto-numbered "Article N — …"), `### `
 * sub-heading, `- `/`* ` bullets, `1. ` ordered items, blank-line-separated
 * paragraphs, **bold**. Anything else is plain paragraph text.
 */
export function markdownToBlocks(md: string, locale: DocLocale): DocBlock[] {
  const blocks: DocBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let article = 0;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const rawLine of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 2) {
        article += 1;
        const n = localizeDigits(String(article), locale);
        blocks.push({ type: "heading", level: 1, text: locale === "fa" ? `ماده ${n} — ${text}` : `Article ${n} — ${text}` });
      } else {
        blocks.push({ type: "heading", level: level === 1 ? 1 : 2, text });
      }
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push((bullet ?? ordered)![1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
