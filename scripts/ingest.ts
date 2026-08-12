/**
 * Rebuilds the RAG knowledge base: site copy (messages/*.json,
 * content/projects.ts) plus any curated docs in content/knowledge/*.md.
 * Run with `npm run ingest` after content changes. Safe to re-run — each
 * source's chunks are fully replaced, not duplicated.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";
import { getEmbeddingConfig } from "@/lib/ai/embedding-config";
import { ingestCuratedDocs, ingestSiteCopy, type CuratedDoc } from "@/lib/ai/ingest";
import { isEmbeddingProviderConfigured } from "@/lib/ai/retrieval";
import type { Locale } from "@/lib/ai/types";

const KNOWLEDGE_DIR = join(process.cwd(), "content", "knowledge");
const DOC_FILENAME_RE = /^(.+)\.(en|fa)\.md$/;

function readCuratedDocs(): CuratedDoc[] {
  let entries: string[];
  try {
    entries = readdirSync(KNOWLEDGE_DIR);
  } catch {
    return [];
  }

  const docs: CuratedDoc[] = [];
  for (const entry of entries) {
    const match = entry.match(DOC_FILENAME_RE);
    if (!match) continue;
    const [, slug, locale] = match;
    docs.push({
      filename: slug,
      locale: locale as Locale,
      content: readFileSync(join(KNOWLEDGE_DIR, entry), "utf-8"),
    });
  }
  return docs;
}

async function main() {
  if (!isSupabaseServiceConfigured()) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY — fill in .env.local first.");
    process.exit(1);
  }

  const embeddingConfig = await getEmbeddingConfig();
  if (!isEmbeddingProviderConfigured(embeddingConfig.provider)) {
    console.error(
      `embedding_config.provider is '${embeddingConfig.provider}' but its API key isn't set in .env.local.`,
    );
    process.exit(1);
  }

  console.log("Ingesting site copy...");
  const siteResults = await ingestSiteCopy();
  for (const r of siteResults) {
    console.log(`  ${r.sourceKey} [${r.locale}] -> ${r.chunks} chunks`);
  }

  const docs = readCuratedDocs();
  if (docs.length === 0) {
    console.log("No curated docs found in content/knowledge/ — skipping.");
  } else {
    console.log(`Ingesting ${docs.length} curated doc(s)...`);
    const docResults = await ingestCuratedDocs(docs);
    for (const r of docResults) {
      console.log(`  ${r.sourceKey} [${r.locale}] -> ${r.chunks} chunks`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
