import "server-only";

/**
 * Thin Telegram Bot API client. Channel-specific by design — nothing here
 * is imported by lib/ai/*, which stays channel-agnostic.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Both the token AND the webhook secret are required for "configured" —
 * without the secret, the webhook route can't verify a request actually
 * came from Telegram, so we treat that as not safely usable rather than
 * silently accepting unauthenticated calls to a public POST endpoint.
 */
export function isTelegramConfigured(): boolean {
  return Boolean(botToken && webhookSecret);
}

/** Telegram echoes this header back on every webhook call once set via setWebhook's secret_token. */
export function isValidTelegramSecret(headerValue: string | null): boolean {
  return Boolean(webhookSecret) && headerValue === webhookSecret;
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  if (!botToken) throw new Error("telegram_not_configured");

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`telegram_send_failed: ${response.status} ${body}`);
  }
}

/** Best-effort "typing…" indicator — never let a failure here block the actual reply. */
export async function sendTelegramChatAction(chatId: number | string): Promise<void> {
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
