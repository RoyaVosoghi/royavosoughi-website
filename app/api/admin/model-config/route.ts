import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { updateModelConfig } from "@/lib/ai/model-config";

const WeekdayScheduleSchema = z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.string().trim().min(1).max(100));

const BodySchema = z.object({
  channel: z.enum(["web", "telegram", "widget"]),
  activeModel: z.string().trim().min(1).max(100),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(8192),
  topP: z.number().min(0).max(1),
  fallbackModel: z.string().trim().min(1).max(100).nullable().optional(),
  schedule: WeekdayScheduleSchema.nullable().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("editor");
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

  const { channel, ...update } = parsed.data;

  try {
    await updateModelConfig(channel, update);
    await writeAuditLog("model_config.update", channel);
  } catch (err) {
    console.error("[admin/model-config] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
