export type Channel = "web" | "telegram" | "widget";
export type ChatRole = "user" | "assistant" | "tool";
export type Locale = "en" | "fa";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface BrainTurnInput {
  channel: Channel;
  channelSessionId: string;
  locale: Locale;
  userMessage: string;
  /** Caller-provided IP, used only for rate limiting — never persisted on a message. */
  ip?: string | null;
}

export interface BrainTurnOutput {
  reply: string;
  sessionId: string;
  /** The assistant reply's message id — channels that support feedback (web, widget) attach thumbs up/down to this. Empty string when paused (no assistant message was generated this turn). */
  messageId: string;
  /** Distinct document titles the reply was grounded in, if any — surfaced on the full chat page as "Sources". */
  sources: string[];
  /** True when an admin paused the bot for this conversation (see /admin/conversations) — the visitor's message was stored, but no model reply was generated. The channel should show a "waiting for a person" state instead of an empty bubble. */
  paused?: boolean;
}

/** Thrown by runBrainTurn when the session+IP have exceeded the message quota. */
export class RateLimitError extends Error {
  constructor() {
    super("rate_limited");
    this.name = "RateLimitError";
  }
}

/** Thrown by runBrainTurn when Gemini or the Supabase service role client isn't configured. */
export class BrainNotConfiguredError extends Error {
  constructor() {
    super("not_configured");
    this.name = "BrainNotConfiguredError";
  }
}
