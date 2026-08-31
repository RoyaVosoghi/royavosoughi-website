import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { reorderPipelineStages, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
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
    await reorderPipelineStages(parsed.data.orderedIds);
    await writeAuditLog("pipeline_stage.reorder", parsed.data.orderedIds.join(","));
  } catch (err) {
    console.error("[admin/pipeline-stages] reorder failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
