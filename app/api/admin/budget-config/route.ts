import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { updateBudgetConfig } from "@/lib/ai/budget";

const BodySchema = z.object({
  monthlyCapUsd: z.number().min(0).max(100000).nullable().optional(),
  alertThresholdPct: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("owner");
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
    await updateBudgetConfig(parsed.data);
    await writeAuditLog("budget_config.update");
  } catch (err) {
    console.error("[admin/budget-config] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
