import "server-only";

import * as cheerio from "cheerio";

import { ingestSource, type IngestResult } from "./ingest";
import type { Locale } from "./types";

export interface FileIngestInput {
  sourceKey: string;
  locale: Locale;
  tags?: string[];
  buffer: Buffer;
}

export async function ingestPdf(input: FileIngestInput): Promise<IngestResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: input.buffer });
  try {
    const result = await parser.getText();
    return ingestSource({
      sourceType: "pdf",
      sourceKey: input.sourceKey,
      locale: input.locale,
      tags: input.tags,
      sections: [{ body: result.text }],
    });
  } finally {
    await parser.destroy();
  }
}

export async function ingestDocx(input: FileIngestInput): Promise<IngestResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: input.buffer });
  return ingestSource({
    sourceType: "docx",
    sourceKey: input.sourceKey,
    locale: input.locale,
    tags: input.tags,
    sections: [{ body: result.value }],
  });
}

export interface UrlIngestInput {
  sourceKey: string;
  locale: Locale;
  tags?: string[];
  url: string;
}

/** Strips script/style/nav/footer/header and collapses whitespace — good enough text extraction for a knowledge-base article, not a general-purpose readability parser. */
export async function ingestUrl(input: UrlIngestInput): Promise<IngestResult> {
  const response = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; RoyaBot/1.0)" } });
  if (!response.ok) throw new Error(`fetch_failed: ${response.status}`);
  const html = await response.text();

  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, svg").remove();
  const title = $("title").first().text().trim();
  const bodyText = $("body").text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return ingestSource({
    sourceType: "url",
    sourceKey: input.sourceKey,
    locale: input.locale,
    tags: input.tags,
    sourceUrl: input.url,
    sections: [{ heading: title || undefined, body: bodyText }],
  });
}
