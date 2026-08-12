import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEmbeddingConfig } from "./embedding-config";
import { embed } from "./providers/embeddings";

export interface DocumentRow {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  status: "active" | "archived";
  tags: string[];
  locale: string;
  chunkCount: number;
  createdAt: string;
}

export async function getDocuments(): Promise<DocumentRow[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, source_type, source_url, status, tags, locale, created_at, chunks(count)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const chunkAgg = Array.isArray(row.chunks) ? row.chunks[0] : row.chunks;
    return {
      id: row.id,
      title: row.title,
      sourceType: row.source_type,
      sourceUrl: row.source_url,
      status: row.status,
      tags: row.tags ?? [],
      locale: row.locale,
      chunkCount: (chunkAgg as { count: number } | undefined)?.count ?? 0,
      createdAt: row.created_at,
    };
  });
}

export interface DocumentChunk {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
}

export async function getDocumentWithChunks(
  id: string,
): Promise<{ document: DocumentRow; chunks: DocumentChunk[] } | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, title, source_type, source_url, status, tags, locale, created_at")
    .eq("id", id)
    .maybeSingle();
  if (docError) throw docError;
  if (!doc) return null;

  const { data: chunks, error: chunksError } = await supabase
    .from("chunks")
    .select("id, chunk_index, content, token_count")
    .eq("document_id", id)
    .order("chunk_index", { ascending: true });
  if (chunksError) throw chunksError;

  return {
    document: {
      id: doc.id,
      title: doc.title,
      sourceType: doc.source_type,
      sourceUrl: doc.source_url,
      status: doc.status,
      tags: doc.tags ?? [],
      locale: doc.locale,
      chunkCount: chunks?.length ?? 0,
      createdAt: doc.created_at,
    },
    chunks: (chunks ?? []).map((c) => ({
      id: c.id,
      chunkIndex: c.chunk_index,
      content: c.content,
      tokenCount: c.token_count,
    })),
  };
}

export async function updateDocument(
  id: string,
  update: { status?: "active" | "archived"; tags?: string[] },
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = {};
  if (update.status !== undefined) patch.status = update.status;
  if (update.tags !== undefined) patch.tags = update.tags;

  const { error } = await supabase.from("documents").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

/** Re-embeds one document's existing chunks with the current embedding_config — scoped version of the global "rebuild index" action, for when just one source drifted (e.g. re-run after a provider switch missed it). */
export async function reindexDocument(id: string): Promise<{ updated: number; failed: number }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const config = await getEmbeddingConfig();
  const { data: chunks, error } = await supabase.from("chunks").select("id, content").eq("document_id", id);
  if (error) throw error;

  let updated = 0;
  let failed = 0;
  for (const chunk of (chunks ?? []) as Array<{ id: string; content: string }>) {
    try {
      const embedding = await embed(chunk.content, config.provider, config.model, config.dimensions, "document");
      const { error: updateError } = await supabase.from("chunks").update({ embedding }).eq("id", chunk.id);
      if (updateError) throw updateError;
      updated++;
    } catch (err) {
      console.error(`[documents] reindex chunk ${chunk.id} failed:`, err);
      failed++;
    }
  }

  return { updated, failed };
}
