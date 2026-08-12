import { NextResponse } from "next/server";

import { prepareBrainTurn, streamBrainTurn } from "@/lib/ai/brain";
import { ChatRequestSchema } from "@/lib/ai/chat-schema";
import { createChatStreamResponse } from "@/lib/ai/sse";
import { BrainNotConfiguredError, RateLimitError } from "@/lib/ai/types";
import { getClientIp } from "@/lib/http";

// Not edge: the admin Supabase client + Gemini SDK are Node-based, and the
// tool-calling loop makes multiple sequential upstream round-trips.
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
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

  let prepared;
  try {
    prepared = await prepareBrainTurn({
      channel: "web",
      channelSessionId,
      locale,
      userMessage: message,
      ip: getClientIp(request),
    });
  } catch (err) {
    if (err instanceof BrainNotConfiguredError) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    // Log server-side; never leak Gemini/Supabase error detail to the client.
    console.error("[chat] prepareBrainTurn failed:", err);
    return NextResponse.json({ error: "upstream_failed" }, { status: 500 });
  }

  if (prepared.paused) {
    return NextResponse.json({ reply: "", sessionId: prepared.sessionId, messageId: "", sources: [], paused: true });
  }

  return createChatStreamResponse(streamBrainTurn(prepared.turn));
}
