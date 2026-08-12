import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { createAdminUser, writeAuditLog } from "@/lib/admin/queries";

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(["owner", "editor", "operator", "viewer"]),
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
    await createAdminUser(parsed.data.email, parsed.data.password, parsed.data.role);
    await writeAuditLog("team.create", parsed.data.email);
  } catch (err) {
    console.error("[admin/team] create failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
