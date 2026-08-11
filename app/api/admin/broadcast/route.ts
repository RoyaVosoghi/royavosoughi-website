import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/lib/admin/auth";
import { getTelegramRecipients, writeAuditLog } from "@/lib/admin/queries";
import { sendTelegramMessage } from "@/lib/telegram";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  /** Without confirm:true this is a dry run — returns the recipient count and sends nothing. */
  confirm: z.boolean().optional(),
});

/** Telegram's Bot API rate-limits outbound sends (~30/sec across all chats) — this delay keeps a broadcast comfortably under that without needing a queue for what's realistically a small audience. */
const SEND_DELAY_MS = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const { message, confirm } = parsed.data;

  let recipients: string[];
  try {
    recipients = await getTelegramRecipients();
  } catch (err) {
    console.error("[admin/broadcast] recipient lookup failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  if (!confirm) {
    return NextResponse.json({ ok: true, dryRun: true, recipientCount: recipients.length });
  }

  let sent = 0;
  let failed = 0;
  for (const chatId of recipients) {
    try {
      await sendTelegramMessage(chatId, message);
      sent++;
    } catch (err) {
      failed++;
      console.error(`[admin/broadcast] send to ${chatId} failed:`, err);
    }
    await sleep(SEND_DELAY_MS);
  }

  await writeAuditLog("broadcast.send", `telegram: ${sent} sent, ${failed} failed`);

  return NextResponse.json({ ok: true, sent, failed });
}
