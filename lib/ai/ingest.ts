import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";
import { projects } from "@/content/projects";

import { chunkText } from "./chunk";
import { embedText } from "./retrieval";
import type { Locale } from "./types";

export interface IngestSection {
  heading?: string;
  body: string;
}

export interface IngestSourceInput {
  sourceType: "site_copy" | "curated_doc";
  sourceKey: string;
  locale: Locale;
  sections: IngestSection[];
}

export interface IngestResult {
  sourceKey: string;
  locale: Locale;
  chunks: number;
}

/**
 * Shared core for both adapters below. Deletes any existing chunks for this
 * (source_key, locale) first, then inserts fresh ones — a full rebuild per
 * source, so re-running after a content edit is always idempotent.
 */
export async function ingestSource(input: IngestSourceInput): Promise<IngestResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const text = input.sections
    .map((s) => (s.heading ? `${s.heading}\n${s.body}` : s.body))
    .filter((s) => s.trim().length > 0)
    .join("\n\n");

  const chunks = text.trim() ? chunkText(text) : [];

  const { error: deleteError } = await supabase
    .from("kb_chunks")
    .delete()
    .eq("source_key", input.sourceKey)
    .eq("locale", input.locale);
  if (deleteError) throw deleteError;

  let written = 0;
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    const { error } = await supabase.from("kb_chunks").insert({
      source_type: input.sourceType,
      source_key: input.sourceKey,
      locale: input.locale,
      chunk_index: i,
      content: chunks[i],
      embedding,
    });
    if (error) throw error;
    written++;
  }

  return { sourceKey: input.sourceKey, locale: input.locale, chunks: written };
}

// -----------------------------------------------------------------------------
// Adapter A — site copy (messages/en.json, messages/fa.json, content/projects.ts)
// -----------------------------------------------------------------------------

/** Only these namespaces carry knowledge worth answering questions from — nav/footer/form labels aren't. */
const KNOWLEDGE_NAMESPACES = ["about", "aboutPage", "services"] as const;

function flattenStrings(value: unknown, path: string[], out: IngestSection[]): void {
  if (typeof value === "string") {
    if (value.trim()) out.push({ heading: path.join("."), body: value });
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flattenStrings(child, [...path, key], out);
    }
  }
}

function siteCopySections(messages: Record<string, unknown>, locale: Locale): IngestSection[] {
  const sections: IngestSection[] = [];

  for (const namespace of KNOWLEDGE_NAMESPACES) {
    flattenStrings(messages[namespace], [namespace], sections);
  }

  // Filtered the same way the site itself filters: draft projects never
  // reach a visitor, so they must never reach the chatbot's knowledge base.
  for (const project of projects) {
    if (project.draft) continue;
    const copy = project[locale];
    sections.push({
      heading: `project.${project.slug}`,
      body: `${copy.title}\n${copy.problem}\n${copy.learned}`,
    });
  }

  return sections;
}

export async function ingestSiteCopy(): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  results.push(
    await ingestSource({
      sourceType: "site_copy",
      sourceKey: "site:copy",
      locale: "en",
      sections: siteCopySections(enMessages as Record<string, unknown>, "en"),
    }),
  );
  results.push(
    await ingestSource({
      sourceType: "site_copy",
      sourceKey: "site:copy",
      locale: "fa",
      sections: siteCopySections(faMessages as Record<string, unknown>, "fa"),
    }),
  );
  return results;
}

// -----------------------------------------------------------------------------
// Adapter B — curated docs (content/knowledge/*.md)
// -----------------------------------------------------------------------------

export interface CuratedDoc {
  /** Filename without extension, becomes source_key = `doc:<filename>`. */
  filename: string;
  locale: Locale;
  content: string;
}

/**
 * Takes already-read file contents rather than touching the filesystem
 * itself, so this stays usable from scripts/ingest.ts (Node fs) without
 * lib/ai/ingest.ts needing to know how docs are discovered.
 */
export async function ingestCuratedDocs(docs: CuratedDoc[]): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const doc of docs) {
    results.push(
      await ingestSource({
        sourceType: "curated_doc",
        sourceKey: `doc:${doc.filename}`,
        locale: doc.locale,
        sections: [{ body: doc.content }],
      }),
    );
  }
  return results;
}
