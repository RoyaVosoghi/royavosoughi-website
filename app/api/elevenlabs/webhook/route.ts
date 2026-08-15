import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Not edge — uses the Supabase service-role client, same as every other
// webhook/route handler in this app.
export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;

interface DataCollectionField {
  value?: unknown;
  rationale?: string;
}

interface PostCallTranscriptionData {
  agent_id?: string;
  conversation_id?: string;
  analysis?: {
    data_collection_results?: Record<string, DataCollectionField>;
    transcript_summary?: string;
  };
}

function fieldValue(
  results: Record<string, DataCollectionField> | undefined,
  key: string,
): string | undefined {
  const value = results?.[key]?.value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

/**
 * Post-call webhook from the ElevenLabs voice/chat agent (see
 * components/chat/ElevenLabsVoiceWidget.tsx) — that agent runs entirely on
 * ElevenLabs' platform, separate from lib/ai/'s own brain, so this is the
 * only bridge that gets its captured leads into our own `leads` table
 * instead of being stranded in ElevenLabs' dashboard.
 *
 * Registered agent-side via conversation_config.platform_settings
 * .workspace_overrides.webhooks.post_call_webhook_id — not something this
 * repo controls directly, see the ElevenLabs dashboard.
 */
export async function POST(request: Request) {
  if (!WEBHOOK_SECRET) {
    console.error("[elevenlabs webhook] ELEVENLABS_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("elevenlabs-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 401 });
  }

  // A real apiKey isn't needed here — constructEvent only verifies the HMAC
  // locally, no network call — but the SDK's constructor still requires a
  // non-empty string. Using a placeholder keeps the actual management key
  // (agent write access) out of this publicly-reachable endpoint entirely.
  const elevenlabs = new ElevenLabsClient({ apiKey: "unused-webhook-only" });
  let event: { type?: string; data?: PostCallTranscriptionData };
  try {
    event = (await elevenlabs.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)) as typeof event;
  } catch (err) {
    console.error("[elevenlabs webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (event.type !== "post_call_transcription") {
    return NextResponse.json({ received: true });
  }

  const results = event.data?.analysis?.data_collection_results;
  const email = fieldValue(results, "client_email");

  // No email means nothing to follow up on — most calls/chats are just
  // browsing, and that's expected, not an error.
  if (!email) {
    return NextResponse.json({ received: true });
  }

  const name = fieldValue(results, "client_name") ?? "Website visitor";
  const inquiryType = fieldValue(results, "inquiry_type");
  const wantsConsultation = results?.consultation_interest?.value === true;
  const interest = [inquiryType, wantsConsultation ? "wants a consultation" : null]
    .filter(Boolean)
    .join(" — ");

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error("[elevenlabs webhook] Supabase not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { error } = await supabase.from("leads").insert({
    name,
    email,
    interest: interest || null,
    source: "elevenlabs",
  });

  if (error) {
    console.error("[elevenlabs webhook] lead insert failed:", error.message);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
