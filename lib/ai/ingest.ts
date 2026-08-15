import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";
import { projects } from "@/content/projects";

import { chunkText } from "./chunk";
import { getEmbeddingConfig } from "./embedding-config";
import { embedText } from "./retrieval";
import type { Locale } from "./types";

export interface IngestSection {
  heading?: string;
  body: string;
}

export interface IngestSourceInput {
  sourceType: "site_copy" | "curated_doc" | "pdf" | "docx" | "url";
  /** Becomes documents.title — the stable dedupe key for re-ingestion. */
  sourceKey: string;
  locale: Locale;
  sections: IngestSection[];
  sourceUrl?: string;
  tags?: string[];
}

export interface IngestResult {
  sourceKey: string;
  locale: Locale;
  chunks: number;
  documentId: string;
}

/** Rough chars-to-tokens estimate (~4 chars/token for English/Persian) — not a real tokenizer, just enough for the admin panel's token_count display. */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Shared core for both adapters below. Upserts a `documents` row for
 * (title=sourceKey, locale) — creating it on first ingest, keeping the same
 * id on every later run — then deletes and re-inserts that document's
 * `chunks`. A full rebuild per document, so re-running after a content edit
 * is always idempotent.
 */
export async function ingestSource(input: IngestSourceInput): Promise<IngestResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const text = input.sections
    .map((s) => (s.heading ? `${s.heading}\n${s.body}` : s.body))
    .filter((s) => s.trim().length > 0)
    .join("\n\n");

  // Read live from /admin/settings — a chunk-size tweak in the panel takes
  // effect on the very next `npm run ingest`, no code change or redeploy.
  const embeddingConfig = await getEmbeddingConfig();
  const chunks = text.trim()
    ? chunkText(text, {
        chunkSize: embeddingConfig.chunkSize,
        chunkOverlap: embeddingConfig.chunkOverlap,
      })
    : [];

  const { data: document, error: upsertError } = await supabase
    .from("documents")
    .upsert(
      {
        title: input.sourceKey,
        locale: input.locale,
        source_type: input.sourceType,
        source_url: input.sourceUrl ?? null,
        tags: input.tags ?? [],
        status: "active",
      },
      { onConflict: "title,locale" },
    )
    .select("id")
    .single();
  if (upsertError) throw upsertError;

  const { error: deleteError } = await supabase.from("chunks").delete().eq("document_id", document.id);
  if (deleteError) throw deleteError;

  let written = 0;
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i], "document");
    const { error } = await supabase.from("chunks").insert({
      document_id: document.id,
      chunk_index: i,
      content: chunks[i],
      token_count: estimateTokenCount(chunks[i]),
      embedding,
    });
    if (error) throw error;
    written++;
  }

  return { sourceKey: input.sourceKey, locale: input.locale, chunks: written, documentId: document.id as string };
}

// -----------------------------------------------------------------------------
// Adapter A — site copy (messages/en.json, messages/fa.json, content/projects.ts)
// -----------------------------------------------------------------------------

/** Only these namespaces carry knowledge worth answering questions from — nav/footer/form labels aren't. */
const KNOWLEDGE_NAMESPACES = ["about", "aboutPage", "services"] as const;

/** Human-readable heading per namespace — shown to the model as context, unlike the raw i18n key paths (see flattenStrings below). */
const NAMESPACE_HEADINGS: Record<(typeof KNOWLEDGE_NAMESPACES)[number], string> = {
  about: "About Roya",
  aboutPage: "About page",
  services: "Services",
};

/**
 * Collects every leaf string under `value` in JSON key order. Deliberately
 * drops the i18n key path (e.g. "about.readMore") — earlier this was kept as
 * a per-string "heading" and joined straight into the chunked text, so the
 * model would sometimes quote raw fragments like "about.readMore\nMore about
 * me" back to visitors instead of writing a real sentence. Grouping by
 * namespace (see siteCopySections) keeps enough structure for retrieval
 * without exposing CMS internals in what gets embedded.
 */
function flattenStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    if (value.trim()) out.push(value.trim());
    return;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      flattenStrings(child, out);
    }
  }
}

function siteCopySections(messages: Record<string, unknown>, locale: Locale): IngestSection[] {
  const sections: IngestSection[] = [];

  for (const namespace of KNOWLEDGE_NAMESPACES) {
    const strings: string[] = [];
    flattenStrings(messages[namespace], strings);
    if (strings.length > 0) {
      sections.push({ heading: NAMESPACE_HEADINGS[namespace], body: strings.join("\n\n") });
    }
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
