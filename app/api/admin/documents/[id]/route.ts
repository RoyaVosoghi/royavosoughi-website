import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { deleteDocument, updateDocument } from "@/lib/ai/documents";

const PatchSchema = z.object({
  status: z.enum(["active", "archived"]).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("editor");
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
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    await updateDocument(id, parsed.data);
    await writeAuditLog("document.update", id);
  } catch (err) {
    console.error("[admin/documents] update failed:", err);
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
    await deleteDocument(id);
    await writeAuditLog("document.delete", id);
  } catch (err) {
    console.error("[admin/documents] delete failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
