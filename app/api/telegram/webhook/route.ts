import { NextResponse } from "next/server";
import { z } from "zod";

import { runBrainTurn } from "@/lib/ai/brain";
import { BrainNotConfiguredError, RateLimitError } from "@/lib/ai/types";
import {
  isTelegramConfigured,
  isValidTelegramSecret,
  sendTelegramChatAction,
  sendTelegramMessage,
} from "@/lib/telegram";

// Not edge — same reasoning as app/api/chat/route.ts: the tool-calling loop
// makes multiple sequential upstream round-trips.
export const runtime = "nodejs";

const TelegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
      from: z.object({ language_code: z.string().optional() }).optional(),
    })
    .optional(),
});

function detectLocale(languageCode: string | undefined): "en" | "fa" {
  return languageCode?.toLowerCase().startsWith("fa") ? "fa" : "en";
}

const FALLBACK: Record<"en" | "fa", string> = {
  en: "Sorry, something went wrong on my end. Please try again in a moment.",
  fa: "متاسفم، یک مشکلی پیش آمد. لطفا کمی بعد دوباره امتحان کنید.",
};

const RATE_LIMITED: Record<"en" | "fa", string> = {
  en: "You've sent a lot of messages in a short time — please wait a few minutes and try again.",
  fa: "در مدت کوتاهی پیام‌های زیادی فرستادید — لطفا چند دقیقه صبر کنید و دوباره امتحان کنید.",
};

export async function POST(request: Request) {
  // Nothing usable without both a token and a webhook secret. Ack with 200
  // so Telegram doesn't treat this as a delivery failure and keep retrying.
  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!isValidTelegramSecret(secretHeader)) {
    return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = TelegramUpdateSchema.safeParse(body);
  const message = parsed.success ? parsed.data.message : undefined;
  const text = message?.text?.trim();
  const chatId = message?.chat.id;

  // Ignore anything without plain text (stickers, edits, channel posts, etc.).
  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  const locale = detectLocale(message?.from?.language_code);

  await sendTelegramChatAction(chatId);

  try {
    const result = await runBrainTurn({
      channel: "telegram",
      channelSessionId: String(chatId),
      locale,
      userMessage: text,
    });
    await sendTelegramMessage(chatId, result.reply);
  } catch (err) {
    const reply =
      err instanceof RateLimitError
        ? RATE_LIMITED[locale]
        : err instanceof BrainNotConfiguredError
          ? FALLBACK[locale]
          : FALLBACK[locale];

    if (!(err instanceof RateLimitError) && !(err instanceof BrainNotConfiguredError)) {
      console.error("[telegram webhook] runBrainTurn failed:", err);
    }

    await sendTelegramMessage(chatId, reply).catch((sendErr) => {
      console.error("[telegram webhook] failed to send error reply:", sendErr);
    });
  }

  // Always ack 200 — the reply was already sent via sendMessage above; a
  // non-200 here would just make Telegram redeliver the same update.
  return NextResponse.json({ ok: true });
}
