import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { createPipelineStage, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  color: z.string().trim().max(20).nullable().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("admin");
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

  try {
    const stage = await createPipelineStage(parsed.data);
    await writeAuditLog("pipeline_stage.create", stage.id);
    return NextResponse.json({ ok: true, stage });
  } catch (err) {
    console.error("[admin/pipeline-stages] create failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
