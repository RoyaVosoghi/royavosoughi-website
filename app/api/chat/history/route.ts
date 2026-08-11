import { NextResponse } from "next/server";
import { z } from "zod";

import { findConversation, getPublicMessageHistory } from "@/lib/ai/memory";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

// Not edge — same reasoning as app/api/chat/route.ts.
export const runtime = "nodejs";

const QuerySchema = z.object({ channelSessionId: z.uuid() });

/**
 * Restores a visitor's own conversation on page reload — only ever the 'web'
 * channel (the /chat page + homepage bubble), matched by the client's own
 * localStorage session id. Returns [] for an unknown/new session rather than
 * an error, since "no history yet" is the normal case for a first-time visitor.
 */
export async function GET(request: Request) {
  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ messages: [] });
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ channelSessionId: searchParams.get("channelSessionId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const conversation = await findConversation("web", parsed.data.channelSessionId);
    if (!conversation) return NextResponse.json({ messages: [] });

    const messages = await getPublicMessageHistory(conversation.id, conversation.contextResetAt);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[chat/history] lookup failed:", err);
    return NextResponse.json({ messages: [] });
  }
}
