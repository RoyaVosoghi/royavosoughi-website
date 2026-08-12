import { NextResponse } from "next/server";

import { prepareBrainTurn, streamBrainTurn } from "@/lib/ai/brain";
import { ChatRequestSchema } from "@/lib/ai/chat-schema";
import { createChatStreamResponse } from "@/lib/ai/sse";
import { BrainNotConfiguredError, RateLimitError } from "@/lib/ai/types";
import { getWidgetConfig, isOriginAllowed, widgetCorsHeaders } from "@/lib/ai/widget-config";
import { getClientIp } from "@/lib/http";

// Not edge — same reasoning as app/api/chat/route.ts.
export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  const { allowedDomains } = await getWidgetConfig();
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin, allowedDomains)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: widgetCorsHeaders(origin, allowedDomains) });
}

export async function POST(request: Request) {
  const { allowedDomains } = await getWidgetConfig();
  const origin = request.headers.get("origin");

  if (!isOriginAllowed(origin, allowedDomains)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  const corsHeaders = widgetCorsHeaders(origin, allowedDomains);
  const corsJson = (body: unknown, init?: ResponseInit) =>
    NextResponse.json(body, { ...init, headers: { ...corsHeaders, ...init?.headers } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return corsJson({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { website, channelSessionId, locale, message } = parsed.data;

  if (website) {
    return corsJson({ reply: "", sessionId: channelSessionId });
  }

  let prepared;
  try {
    prepared = await prepareBrainTurn({
      channel: "widget",
      channelSessionId,
      locale,
      userMessage: message,
      ip: getClientIp(request),
    });
  } catch (err) {
    if (err instanceof BrainNotConfiguredError) {
      return corsJson({ error: "not_configured" }, { status: 503 });
    }
    if (err instanceof RateLimitError) {
      return corsJson({ error: "rate_limited" }, { status: 429 });
    }
    console.error("[widget chat] prepareBrainTurn failed:", err);
    return corsJson({ error: "upstream_failed" }, { status: 500 });
  }

  if (prepared.paused) {
    return corsJson({ reply: "", sessionId: prepared.sessionId, messageId: "", sources: [], paused: true });
  }

  return createChatStreamResponse(streamBrainTurn(prepared.turn), corsHeaders);
}
