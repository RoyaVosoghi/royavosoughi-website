import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { registerTelegramWebhook } from "@/lib/telegram";

const BodySchema = z.object({ baseUrl: z.url() });

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
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const result = await registerTelegramWebhook(parsed.data.baseUrl);
    await writeAuditLog("channel.telegram.register_webhook", parsed.data.baseUrl);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/channels/telegram/register-webhook] failed:", err);
    return NextResponse.json({ error: "webhook_registration_failed" }, { status: 500 });
  }
}
