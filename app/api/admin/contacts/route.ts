import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { createContact, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(50).nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  status: z.enum(["active", "customer", "inactive"]).optional(),
  source: z.string().trim().max(100).nullable().optional(),
  locale: z.enum(["en", "fa"]).optional(),
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
    const contact = await createContact(parsed.data);
    await writeAuditLog("contact.create", contact.id);
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    console.error("[admin/contacts] create failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
