import "server-only";

import { getChannelSecret } from "@/lib/ai/channel-secrets";

/**
 * Thin Telegram Bot API client. Channel-specific by design — nothing here
 * is imported by lib/ai/*, which stays channel-agnostic.
 *
 * Token/secret resolve DB-first (set from /admin/channels, which can also
 * call setWebhook directly) with the env vars as a fallback for anyone still
 * bootstrapping via .env.local + `npm run telegram:set-webhook`.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

async function getBotToken(): Promise<string | null> {
  return (await getChannelSecret("telegram", "bot_token")) || process.env.TELEGRAM_BOT_TOKEN || null;
}

async function getWebhookSecret(): Promise<string | null> {
  return (await getChannelSecret("telegram", "webhook_secret")) || process.env.TELEGRAM_WEBHOOK_SECRET || null;
}

/**
 * Both the token AND the webhook secret are required for "configured" —
 * without the secret, the webhook route can't verify a request actually
 * came from Telegram, so we treat that as not safely usable rather than
 * silently accepting unauthenticated calls to a public POST endpoint.
 */
export async function isTelegramConfigured(): Promise<boolean> {
  const [token, secret] = await Promise.all([getBotToken(), getWebhookSecret()]);
  return Boolean(token && secret);
}

/** Telegram echoes this header back on every webhook call once set via setWebhook's secret_token. */
export async function isValidTelegramSecret(headerValue: string | null): Promise<boolean> {
  const secret = await getWebhookSecret();
  return Boolean(secret) && headerValue === secret;
}

export interface InlineButton {
  text: string;
  callbackData: string;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  quickReplies?: InlineButton[],
): Promise<void> {
  const botToken = await getBotToken();
  if (!botToken) throw new Error("telegram_not_configured");

  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (quickReplies?.length) {
    body.reply_markup = {
      inline_keyboard: [quickReplies.map((b) => ({ text: b.text, callback_data: b.callbackData }))],
    };
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(`telegram_send_failed: ${response.status} ${responseBody}`);
  }
}

/** Best-effort "typing…" indicator — never let a failure here block the actual reply. */
export async function sendTelegramChatAction(chatId: number | string): Promise<void> {
  const botToken = await getBotToken();
  if (!botToken) return;
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch (err) {
    console.error("[telegram] sendChatAction failed:", err);
  }
}

/** Dismisses the loading spinner Telegram shows on an inline button after it's tapped. Must be called even on our own failure paths, or the button spins until it times out client-side. */
export async function answerTelegramCallbackQuery(callbackQueryId: string): Promise<void> {
  const botToken = await getBotToken();
  if (!botToken) return;
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch (err) {
    console.error("[telegram] answerCallbackQuery failed:", err);
  }
}

/** Registers <baseUrl>/api/telegram/webhook with Telegram — called both by scripts/telegram-set-webhook.ts and the "Save & register webhook" action on /admin/channels. */
export async function registerTelegramWebhook(baseUrl: string): Promise<{ ok: boolean; description?: string }> {
  const botToken = await getBotToken();
  const webhookSecret = await getWebhookSecret();
  if (!botToken || !webhookSecret) throw new Error("telegram_not_configured");

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret }),
  });

  const data = (await response.json()) as { ok: boolean; description?: string };
  return data;
}
