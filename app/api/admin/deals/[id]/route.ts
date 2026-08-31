import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { deleteDeal, updateDeal, writeAuditLog } from "@/lib/admin/queries";

const PatchSchema = z.object({
  pipelineStageId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  expectedCloseDate: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("operator");
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

  const isPureStageChange = parsed.data.pipelineStageId !== undefined && Object.keys(parsed.data).length === 1;

  try {
    await updateDeal(id, parsed.data);
    await writeAuditLog(isPureStageChange ? "deal.stage_change" : "deal.update", id);
  } catch (err) {
    console.error("[admin/deals] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("editor");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  try {
    await deleteDeal(id);
    await writeAuditLog("deal.delete", id);
  } catch (err) {
    console.error("[admin/deals] delete failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
