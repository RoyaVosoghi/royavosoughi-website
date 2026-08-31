import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { convertLeadToContact, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  companyName: z.string().trim().max(200).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const contact = await convertLeadToContact(id, { companyName: parsed.data.companyName });
    await writeAuditLog("lead.convert", contact.id);
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    console.error("[admin/leads] convert failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
