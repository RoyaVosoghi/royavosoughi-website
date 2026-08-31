import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { completeActivity, deleteActivity, updateActivity, writeAuditLog } from "@/lib/admin/queries";

const PatchSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().max(2000).nullable().optional(),
  dueAt: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("operator");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const { completed, ...fields } = parsed.data;
    if (Object.keys(fields).length > 0) await updateActivity(id, fields);
    if (completed) await completeActivity(id);
    await writeAuditLog("activity.update", id);
  } catch (err) {
    console.error("[admin/activities] update failed:", err);
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
    await deleteActivity(id);
    await writeAuditLog("activity.delete", id);
  } catch (err) {
    console.error("[admin/activities] delete failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
