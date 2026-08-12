import { NextResponse } from "next/server";

import { getChannelGreeting } from "@/lib/ai/channel-greetings";
import { getWidgetConfig } from "@/lib/ai/widget-config";

/** Public, read-only, CORS-open — the embeddable widget script fetches this on mount before rendering, same CORS story as app/api/widget/chat/route.ts. Nothing secret in here. */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const [config, quickRepliesEn, quickRepliesFa] = await Promise.all([
    getWidgetConfig(),
    getChannelGreeting("widget", "en"),
    getChannelGreeting("widget", "fa"),
  ]);

  return NextResponse.json(
    { ...config, quickRepliesEn: quickRepliesEn.quickReplies, quickRepliesFa: quickRepliesFa.quickReplies },
    { headers: CORS_HEADERS },
  );
}
