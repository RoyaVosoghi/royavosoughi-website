import { NextResponse } from "next/server";
import { z } from "zod";

import { findConversation, getPublicMessageHistory } from "@/lib/ai/memory";
import { getWidgetConfig, isOriginAllowed, widgetCorsHeaders } from "@/lib/ai/widget-config";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

// Not edge — same reasoning as app/api/chat/route.ts.
export const runtime = "nodejs";

const QuerySchema = z.object({ channelSessionId: z.uuid() });

export async function OPTIONS(request: Request) {
  const { allowedDomains } = await getWidgetConfig();
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin, allowedDomains)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: widgetCorsHeaders(origin, allowedDomains) });
}

/** Polled by the widget only while a conversation is paused for human handoff (lib/widget/entry.ts) — the widget has no other way to receive an operator's manual reply. */
export async function GET(request: Request) {
  const { allowedDomains } = await getWidgetConfig();
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin, allowedDomains)) {
    return new NextResponse(null, { status: 403 });
  }
  const corsHeaders = widgetCorsHeaders(origin, allowedDomains);
  const corsJson = (body: unknown, init?: ResponseInit) =>
    NextResponse.json(body, { ...init, headers: { ...corsHeaders, ...init?.headers } });

  if (!isSupabaseServiceConfigured()) {
    return corsJson({ messages: [] });
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ channelSessionId: searchParams.get("channelSessionId") });
  if (!parsed.success) {
    return corsJson({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const conversation = await findConversation("widget", parsed.data.channelSessionId);
    if (!conversation) return corsJson({ messages: [] });

    const messages = await getPublicMessageHistory(conversation.id, conversation.contextResetAt);
    return corsJson({ messages });
  } catch (err) {
    console.error("[widget/history] lookup failed:", err);
    return corsJson({ messages: [] });
  }
}
