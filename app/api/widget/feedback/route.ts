import { NextResponse } from "next/server";
import { z } from "zod";

import { submitFeedback } from "@/lib/ai/feedback";
import { getWidgetConfig, isOriginAllowed, widgetCorsHeaders } from "@/lib/ai/widget-config";

/** Same origin-restriction story as app/api/widget/chat/route.ts. */
export async function OPTIONS(request: Request) {
  const { allowedDomains } = await getWidgetConfig();
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin, allowedDomains)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: widgetCorsHeaders(origin, allowedDomains) });
}

const FeedbackSchema = z.object({
  messageId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().trim().max(1000).optional(),
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

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson({ error: "validation_failed" }, { status: 400 });
  }

  try {
    await submitFeedback(parsed.data.messageId, parsed.data.rating, parsed.data.comment);
  } catch (err) {
    console.error("[widget feedback] insert failed:", err);
    return corsJson({ error: "storage_failed" }, { status: 500 });
  }

  return corsJson({ ok: true });
}
