import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { updateEmbeddingConfig } from "@/lib/ai/embedding-config";

const BodySchema = z.object({
  chunkSize: z.number().int().min(100).max(6000),
  chunkOverlap: z.number().int().min(0).max(1000),
  topK: z.number().int().min(1).max(20),
  similarityThreshold: z.number().min(0).max(1),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  try {
    await updateEmbeddingConfig(parsed.data);
    await writeAuditLog("embedding_config.update");
  } catch (err) {
    console.error("[admin/embedding-config] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
