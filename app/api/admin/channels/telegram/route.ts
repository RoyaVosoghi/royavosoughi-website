import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { setChannelSecret } from "@/lib/ai/channel-secrets";

const BodySchema = z.object({
  botToken: z.string().trim().min(1).max(200).optional(),
  webhookSecret: z.string().trim().min(1).max(200).optional(),
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
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    if (parsed.data.botToken) await setChannelSecret("telegram", "bot_token", parsed.data.botToken);
    if (parsed.data.webhookSecret) await setChannelSecret("telegram", "webhook_secret", parsed.data.webhookSecret);
    await writeAuditLog("channel.telegram.update_secrets");
  } catch (err) {
    console.error("[admin/channels/telegram] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
