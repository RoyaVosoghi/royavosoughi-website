import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { createCompany, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  domain: z.string().trim().max(200).nullable().optional(),
  industry: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
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
    const company = await createCompany(parsed.data);
    await writeAuditLog("company.create", company.id);
    return NextResponse.json({ ok: true, company });
  } catch (err) {
    console.error("[admin/companies] create failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
