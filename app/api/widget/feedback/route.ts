import { NextResponse } from "next/server";
import { z } from "zod";

import { submitFeedback } from "@/lib/ai/feedback";

/** Same CORS story as app/api/widget/chat/route.ts — the widget runs on third-party origins, so this is the one feedback route that must accept every origin. */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function corsJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { ...CORS_HEADERS, ...init?.headers } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const FeedbackSchema = z.object({
  messageId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
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
