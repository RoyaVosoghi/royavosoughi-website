import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { updateEmbeddingConfig } from "@/lib/ai/embedding-config";

const BodySchema = z.object({
  provider: z.enum(["google", "openai", "cohere", "voyage"]).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  // 2000, not 3072: pgvector's HNSW index caps at 2000 dims (see supabase/schema.sql V3).
  dimensions: z.number().int().min(64).max(2000).optional(),
  inputType: z.string().trim().max(50).nullable().optional(),
  chunkSize: z.number().int().min(100).max(6000).optional(),
  chunkOverlap: z.number().int().min(0).max(1000).optional(),
  chunkingStrategy: z.enum(["paragraph", "fixed"]).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  rerankerEnabled: z.boolean().optional(),
  rerankerModel: z.string().trim().max(100).nullable().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("editor");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  const providerChanged = parsed.data.provider !== undefined || parsed.data.model !== undefined;

  try {
    await updateEmbeddingConfig(parsed.data);
    await writeAuditLog(providerChanged ? "embedding_config.provider_change" : "embedding_config.update");
  } catch (err) {
    console.error("[admin/embedding-config] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, providerChanged });
}
