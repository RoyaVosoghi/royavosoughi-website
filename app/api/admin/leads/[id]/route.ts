import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { updateLead, writeAuditLog } from "@/lib/admin/queries";

const PatchSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
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
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    await updateLead(id, parsed.data);
    await writeAuditLog("lead.update", id);
  } catch (err) {
    console.error("[admin/leads] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
