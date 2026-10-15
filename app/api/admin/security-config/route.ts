import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { updateSecurityConfig } from "@/lib/ai/security-config";

const BodySchema = z.object({
  rateLimitWindowMinutes: z.number().int().min(1).max(1440).optional(),
  rateLimitMaxMessages: z.number().int().min(1).max(1000).optional(),
  retentionDays: z.number().int().min(1).max(3650).nullable().optional(),
  injectionGuardEnabled: z.boolean().optional(),
  workingHours: z
    .object({
      enabled: z.boolean(),
      timezone: z.string().trim().min(1).max(64).refine(isValidTimeZone, "invalid_timezone"),
      start: z.number().int().min(0).max(23),
      end: z.number().int().min(1).max(24),
      days: z.array(z.number().int().min(0).max(6)).max(7),
    })
    .refine((h) => h.end > h.start, "end_before_start")
    .optional(),
});

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

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
    await updateSecurityConfig(parsed.data);
    await writeAuditLog("security_config.update");
  } catch (err) {
    console.error("[admin/security-config] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
