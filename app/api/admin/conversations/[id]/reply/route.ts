import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { getConversation, sendManualReply, writeAuditLog } from "@/lib/admin/queries";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";

const BodySchema = z.object({ content: z.string().trim().min(1).max(4000) });

/** Operators reply here while a conversation is paused (see the pause route) — persisted like any assistant message, and pushed out over Telegram directly since that channel has no polling to catch it otherwise. */
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
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const conversation = await getConversation(id);
    if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const messageId = await sendManualReply(id, parsed.data.content);

    if (conversation.channel === "telegram" && (await isTelegramConfigured())) {
      try {
        await sendTelegramMessage(conversation.externalUserId, parsed.data.content);
      } catch (err) {
        console.error("[admin/conversations/reply] telegram send failed:", err);
      }
    }

    await writeAuditLog("conversation.manual_reply", id);
    return NextResponse.json({ ok: true, messageId });
  } catch (err) {
    console.error("[admin/conversations/reply] failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
