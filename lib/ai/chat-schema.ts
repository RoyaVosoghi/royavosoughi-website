import "server-only";

import { z } from "zod";

/** Shared request shape for every HTTP chat endpoint (web, widget). Telegram has its own — it receives Telegram's update payload, not this. */
export const ChatRequestSchema = z.object({
  channelSessionId: z.uuid(),
  locale: z.enum(["en", "fa"]).default("en"),
  message: z.string().trim().min(1).max(4000),
  /** Honeypot, same pattern as app/api/contact/route.ts — hidden from humans. */
  website: z.string().max(2000).optional(),
});

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  return forwarded.split(",")[0]?.trim() || null;
}
