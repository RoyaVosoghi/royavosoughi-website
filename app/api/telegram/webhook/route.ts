import { NextResponse } from "next/server";
import { z } from "zod";

import { runBrainTurn } from "@/lib/ai/brain";
import { getOrCreateConversation, resetConversationContext, upsertUnifiedUser } from "@/lib/ai/memory";
import { BrainNotConfiguredError, RateLimitError, type Locale } from "@/lib/ai/types";
import {
  answerTelegramCallbackQuery,
  isTelegramConfigured,
  isValidTelegramSecret,
  sendTelegramChatAction,
  sendTelegramMessage,
  type InlineButton,
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
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().optional(),
      message: z.object({ chat: z.object({ id: z.number() }) }).optional(),
      from: z.object({ language_code: z.string().optional() }).optional(),
    })
    .optional(),
});

function detectLocale(languageCode: string | undefined): Locale {
  return languageCode?.toLowerCase().startsWith("fa") ? "fa" : "en";
}

const FALLBACK: Record<Locale, string> = {
  en: "Sorry, something went wrong on my end. Please try again in a moment.",
  fa: "متاسفم، یک مشکلی پیش آمد. لطفا کمی بعد دوباره امتحان کنید.",
};

const RATE_LIMITED: Record<Locale, string> = {
  en: "You've sent a lot of messages in a short time — please wait a few minutes and try again.",
  fa: "در مدت کوتاهی پیام‌های زیادی فرستادید — لطفا چند دقیقه صبر کنید و دوباره امتحان کنید.",
};

const WELCOME: Record<Locale, string> = {
  en: "Hi! I'm Roya's assistant — ask me anything about her work, services, or how to get in touch.",
  fa: "سلام! من دستیار رویا هستم — هر سوالی درباره کار، خدمات یا راه ارتباط با او دارید بپرسید.",
};

const HELP: Record<Locale, string> = {
  en: "Just type your question and I'll answer using what I know about Roya's work. Commands: /start to begin again, /reset to clear our conversation history and start fresh.",
  fa: "کافیست سوالتان را تایپ کنید تا با اطلاعاتی که از کار رویا دارم پاسخ دهم. دستورها: /start برای شروع دوباره، /reset برای پاک‌کردن تاریخچه گفتگو و شروع تازه.",
};

const RESET_DONE: Record<Locale, string> = {
  en: "Done — I've cleared our conversation history. What would you like to know?",
  fa: "انجام شد — تاریخچه گفتگویمان پاک شد. چه چیزی می‌خواهید بدانید؟",
};

const CANNED_REPLIES: Record<string, Record<Locale, string>> = {
  services: { en: "What services do you offer?", fa: "چه خدماتی ارائه می‌دهید؟" },
  consult: { en: "I'd like to book a consultation.", fa: "می‌خواهم یک مشاوره رزرو کنم." },
  human: { en: "I'd like to talk to a real person.", fa: "می‌خواهم با یک انسان واقعی صحبت کنم." },
};

function quickReplyButtons(locale: Locale): InlineButton[] {
  return [
    { text: locale === "fa" ? "خدمات" : "Services", callbackData: "qr:services" },
    { text: locale === "fa" ? "رزرو مشاوره" : "Book a call", callbackData: "qr:consult" },
    { text: locale === "fa" ? "صحبت با انسان" : "Talk to a human", callbackData: "qr:human" },
  ];
}

/** Shared by both a typed message and a quick-reply button tap — same brain call, same reply shape. */
async function handleUserText(chatId: number, locale: Locale, text: string): Promise<void> {
  await sendTelegramChatAction(chatId);

  try {
    const result = await runBrainTurn({
      channel: "telegram",
      channelSessionId: String(chatId),
      locale,
      userMessage: text,
    });
    await sendTelegramMessage(chatId, result.reply, quickReplyButtons(locale));
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
}

/** /start, /help, /reset never reach the LLM — cheap, and don't need rate limiting. Still register the chat_id in unified_users/conversations so a visitor's very first interaction (a command) is tracked like any other. */
async function handleCommand(command: string, chatId: number, locale: Locale): Promise<boolean> {
  if (command !== "/start" && command !== "/help" && command !== "/reset") return false;

  const conversation = await getOrCreateConversation("telegram", String(chatId), locale);
  await upsertUnifiedUser("telegram", String(chatId));

  if (command === "/start") {
    await sendTelegramMessage(chatId, WELCOME[locale], quickReplyButtons(locale));
  } else if (command === "/help") {
    await sendTelegramMessage(chatId, HELP[locale], quickReplyButtons(locale));
  } else {
    await resetConversationContext(conversation.id);
    await sendTelegramMessage(chatId, RESET_DONE[locale], quickReplyButtons(locale));
  }

  return true;
}

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
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const { message, callback_query: callbackQuery } = parsed.data;

  if (callbackQuery?.message) {
    const chatId = callbackQuery.message.chat.id;
    const locale = detectLocale(callbackQuery.from?.language_code);
    const canned = callbackQuery.data ? CANNED_REPLIES[callbackQuery.data.replace(/^qr:/, "")] : undefined;

    await answerTelegramCallbackQuery(callbackQuery.id);
    if (canned) {
      await handleUserText(chatId, locale, canned[locale]);
    }
    return NextResponse.json({ ok: true });
  }

  const text = message?.text?.trim();
  const chatId = message?.chat.id;

  // Ignore anything without plain text (stickers, edits, channel posts, etc.).
  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  const locale = detectLocale(message?.from?.language_code);
  const command = text.split(/\s/)[0].split("@")[0].toLowerCase();

  const handled = await handleCommand(command, chatId, locale).catch((err) => {
    console.error("[telegram webhook] command handling failed:", err);
    return true; // don't fall through to the brain on a broken command path
  });
  if (handled) {
    return NextResponse.json({ ok: true });
  }

  await handleUserText(chatId, locale, text);

  // Always ack 200 — the reply was already sent via sendMessage above; a
  // non-200 here would just make Telegram redeliver the same update.
  return NextResponse.json({ ok: true });
}
