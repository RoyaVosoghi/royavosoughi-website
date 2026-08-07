import { NextResponse } from "next/server";

import { runBrainTurn } from "@/lib/ai/brain";
import { ChatRequestSchema, getClientIp } from "@/lib/ai/chat-schema";
import { BrainNotConfiguredError, RateLimitError } from "@/lib/ai/types";

// Not edge — same reasoning as app/api/chat/route.ts.
export const runtime = "nodejs";

/**
 * The whole point of an embeddable widget is that it works on ANY site, so
 * this is the one route that intentionally allows every origin — unlike
 * app/api/chat/route.ts, which only the same-origin website ever calls.
 * No cookies/credentials are involved (session id is just a body field),
 * so a wildcard origin carries no auth-bypass risk here.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function corsJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...init?.headers },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
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

  try {
    const result = await runBrainTurn({
      channel: "widget",
      channelSessionId,
      locale,
      userMessage: message,
      ip: getClientIp(request),
    });
    return corsJson(result);
  } catch (err) {
    if (err instanceof BrainNotConfiguredError) {
      return corsJson({ error: "not_configured" }, { status: 503 });
    }
    if (err instanceof RateLimitError) {
      return corsJson({ error: "rate_limited" }, { status: 429 });
    }
    console.error("[widget chat] runBrainTurn failed:", err);
    return corsJson({ error: "upstream_failed" }, { status: 500 });
  }
}
