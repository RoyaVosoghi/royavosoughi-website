import { NextResponse } from "next/server";
import { z } from "zod";

import { findConversation, rateConversation } from "@/lib/ai/memory";
import { getWidgetConfig, isOriginAllowed, widgetCorsHeaders } from "@/lib/ai/widget-config";

// Not edge — uses the Supabase service-role client, same as every other
// widget route.
export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  const { allowedDomains } = await getWidgetConfig();
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin, allowedDomains)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: widgetCorsHeaders(origin, allowedDomains) });
}

const RateSchema = z.object({
  channelSessionId: z.string().trim().min(1).max(200),
  rating: z.number().int().min(1).max(5),
});

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

  const parsed = RateSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson({ error: "validation_failed" }, { status: 400 });
  }

  const conversation = await findConversation("widget", parsed.data.channelSessionId);
  if (!conversation) {
    return corsJson({ error: "not_found" }, { status: 404 });
  }

  try {
    await rateConversation(conversation.id, parsed.data.rating);
  } catch (err) {
    console.error("[widget rate-conversation] failed:", err);
    return corsJson({ error: "storage_failed" }, { status: 500 });
  }

  return corsJson({ ok: true });
}
