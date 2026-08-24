import "server-only";

import { getChannelSecret } from "./channel-secrets";
import type { Locale } from "./types";

/**
 * Operational alerting for the admin (currently: Telegram only). Deliberately
 * self-contained rather than importing lib/telegram.ts — that file is a
 * per-channel adapter and stays a one-way dependency on lib/ai/* (see its own
 * header comment), never the reverse, so the brain/tools layer stays
 * channel-agnostic. The ~10 duplicated lines of Bot API call here are the
 * same tradeoff lib/widget/entry.ts makes for the same reason.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

const REASON_LABEL: Record<string, Record<Locale, string>> = {
  out_of_scope: { en: "outside what the bot can help with", fa: "خارج از حوزه‌ی کمک ربات" },
  user_requested: { en: "visitor asked for a human", fa: "بازدیدکننده درخواست صحبت با انسان کرد" },
  other: { en: "other", fa: "سایر" },
};

/** Best-effort — a failed notification must never break the tool call it's attached to, so every error is swallowed here. */
export async function notifyAdminOfHandoff(reason: string, note: string | undefined, locale: Locale): Promise<void> {
  try {
    const [botToken, chatId] = await Promise.all([
      getChannelSecret("telegram", "bot_token"),
      getChannelSecret("telegram", "admin_chat_id"),
    ]);
    if (!botToken || !chatId) return;

    const reasonLabel = REASON_LABEL[reason]?.[locale] ?? reason;
    const text =
      locale === "fa"
        ? `🔔 یک بازدیدکننده درخواست صحبت با انسان دارد.\nدلیل: ${reasonLabel}${note ? `\nیادداشت: ${note}` : ""}\n\nبرای پاسخ به پنل ادمین → صندوق ورودی مراجعه کنید.`
        : `🔔 A visitor is requesting a human.\nReason: ${reasonLabel}${note ? `\nNote: ${note}` : ""}\n\nReply from the admin panel → Inbox.`;

    const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) {
      console.error("[notify-admin] telegram send failed:", response.status, await response.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[notify-admin] failed:", err);
  }
}
