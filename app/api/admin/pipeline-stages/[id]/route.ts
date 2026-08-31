import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { PipelineStageInUseError, deletePipelineStage, updatePipelineStage, writeAuditLog } from "@/lib/admin/queries";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.number().int().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  color: z.string().trim().max(20).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("admin");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    await updatePipelineStage(id, parsed.data);
    await writeAuditLog("pipeline_stage.update", id);
  } catch (err) {
    console.error("[admin/pipeline-stages] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("admin");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  try {
    await deletePipelineStage(id);
    await writeAuditLog("pipeline_stage.delete", id);
  } catch (err) {
    if (err instanceof PipelineStageInUseError) {
      return NextResponse.json({ error: "stage_in_use", dealCount: err.dealCount }, { status: 409 });
    }
    console.error("[admin/pipeline-stages] delete failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
