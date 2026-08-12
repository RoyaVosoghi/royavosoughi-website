import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { getEmbeddingConfig } from "@/lib/ai/embedding-config";
import { embed, isEmbeddingProviderConfigured } from "@/lib/ai/providers/embeddings";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Re-embeds every existing chunk's stored content with whatever embedding_config currently points at — the admin's "rebuild index" button after switching provider/model. Doesn't touch chunking (content is unchanged), only the vector. */
export async function POST() {
  const gate = await requireRole("editor");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  const config = await getEmbeddingConfig();
  if (!isEmbeddingProviderConfigured(config.provider)) {
    return NextResponse.json({ error: "provider_not_configured" }, { status: 400 });
  }

  const { data: chunks, error: fetchError } = await supabase.from("chunks").select("id, content");
  if (fetchError) {
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  let updated = 0;
  let failed = 0;
  const BATCH_SIZE = 3;
  const rows = (chunks ?? []) as Array<{ id: string; content: string }>;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const embedding = await embed(row.content, config.provider, config.model, config.dimensions, "document");
          const { error } = await supabase.from("chunks").update({ embedding }).eq("id", row.id);
          if (error) throw error;
          updated++;
        } catch (err) {
          console.error(`[admin/embedding-config/rebuild] chunk ${row.id} failed:`, err);
          failed++;
        }
      }),
    );
  }

  await writeAuditLog("embedding_config.rebuild", `${updated} updated, ${failed} failed`);

  return NextResponse.json({ ok: true, total: rows.length, updated, failed });
}
