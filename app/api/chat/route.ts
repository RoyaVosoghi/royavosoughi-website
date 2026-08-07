import { NextResponse } from "next/server";
import { z } from "zod";

import { runBrainTurn } from "@/lib/ai/brain";
import { BrainNotConfiguredError, RateLimitError } from "@/lib/ai/types";

// Not edge: the admin Supabase client + Gemini SDK are Node-based, and the
// tool-calling loop makes multiple sequential upstream round-trips.
export const runtime = "nodejs";

const ChatSchema = z.object({
  channelSessionId: z.uuid(),
  locale: z.enum(["en", "fa"]).default("en"),
  message: z.string().trim().min(1).max(4000),
  /** Honeypot, same pattern as app/api/contact/route.ts — hidden from humans. */
  website: z.string().max(2000).optional(),
});

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  return forwarded.split(",")[0]?.trim() || null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { website, channelSessionId, locale, message } = parsed.data;

  // Bot filled the honeypot. Answer harmlessly so it never learns which
  // field gave it away — mirrors the contact route.
  if (website) {
    return NextResponse.json({ reply: "", sessionId: channelSessionId });
  }

  try {
    const result = await runBrainTurn({
      channel: "web",
      channelSessionId,
      locale,
      userMessage: message,
      ip: getClientIp(request),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BrainNotConfiguredError) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    // Log server-side; never leak Gemini/Supabase error detail to the client.
    console.error("[chat] runBrainTurn failed:", err);
    return NextResponse.json({ error: "upstream_failed" }, { status: 500 });
  }
}
