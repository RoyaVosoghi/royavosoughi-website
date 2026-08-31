import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { createDeal, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  contactId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  pipelineStageId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  expectedCloseDate: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("operator");
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
    const deal = await createDeal(parsed.data);
    await writeAuditLog("deal.create", deal.id);
    return NextResponse.json({ ok: true, deal });
  } catch (err) {
    console.error("[admin/deals] create failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
