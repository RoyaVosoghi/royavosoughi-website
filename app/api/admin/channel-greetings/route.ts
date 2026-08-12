import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { updateChannelGreeting } from "@/lib/ai/channel-greetings";

const BodySchema = z.object({
  channel: z.enum(["web", "telegram", "widget"]),
  locale: z.enum(["en", "fa"]),
  welcomeMessage: z.string().trim().max(500).nullable(),
  quickReplies: z.array(z.string().trim().min(1).max(80)).max(6),
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

  const { channel, locale, ...update } = parsed.data;

  try {
    await updateChannelGreeting(channel, locale, update);
    await writeAuditLog("channel_greeting.update", `${channel}:${locale}`);
  } catch (err) {
    console.error("[admin/channel-greetings] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
