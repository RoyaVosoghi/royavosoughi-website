import { NextResponse } from "next/server";
import { z } from "zod";

import { closeConversation, findConversation } from "@/lib/ai/memory";
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

const CloseSchema = z.object({
  channelSessionId: z.string().trim().min(1).max(200),
  reason: z.enum(["user_closed", "idle_timeout"]),
});

/** Called when the widget's own idle timer fires, or the visitor explicitly closes the panel — see lib/widget/entry.ts. ElevenLabs has no equivalent for text sessions (confirmed: no server-side inactivity close), so this is entirely client-driven. */
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

  const parsed = CloseSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson({ error: "validation_failed" }, { status: 400 });
  }

  const conversation = await findConversation("widget", parsed.data.channelSessionId);
  // No conversation yet (widget opened but nothing was ever sent) — nothing to close.
  if (!conversation) {
    return corsJson({ ok: true });
  }

  try {
    await closeConversation(conversation.id, parsed.data.reason);
  } catch (err) {
    console.error("[widget close-conversation] failed:", err);
    return corsJson({ error: "storage_failed" }, { status: 500 });
  }

  return corsJson({ ok: true });
}
