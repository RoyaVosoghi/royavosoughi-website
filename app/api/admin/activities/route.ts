import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { createActivity, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  contactId: z.string().uuid(),
  dealId: z.string().uuid().nullable().optional(),
  type: z.enum(["call", "meeting", "note", "task"]),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("operator");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const activity = await createActivity(parsed.data);
    await writeAuditLog("activity.create", activity.id);
    return NextResponse.json({ ok: true, activity });
  } catch (err) {
    console.error("[admin/activities] create failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
