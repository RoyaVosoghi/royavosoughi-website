import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Channel, ChatMessage, ChatRole, Locale } from "./types";

export interface ChatSession {
  id: string;
  channel: Channel;
  channelSessionId: string;
  locale: Locale;
  leadEmail: string | null;
}

type SessionRow = {
  id: string;
  channel: Channel;
  channel_session_id: string;
  locale: Locale;
  lead_email: string | null;
};

function toSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    channel: row.channel,
    channelSessionId: row.channel_session_id,
    locale: row.locale,
    leadEmail: row.lead_email,
  };
}

export async function getOrCreateSession(
  channel: Channel,
  channelSessionId: string,
  locale: Locale,
): Promise<ChatSession> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { data: existing, error: fetchError } = await supabase
    .from("chat_sessions")
    .select("id, channel, channel_session_id, locale, lead_email")
    .eq("channel", channel)
    .eq("channel_session_id", channelSessionId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    await supabase
      .from("chat_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", existing.id);
    return toSession(existing as SessionRow);
  }

  const { data: created, error: insertError } = await supabase
    .from("chat_sessions")
    .insert({ channel, channel_session_id: channelSessionId, locale })
    .select("id, channel, channel_session_id, locale, lead_email")
    .single();

  if (insertError) throw insertError;

  return toSession(created as SessionRow);
}

export async function appendMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
  toolMeta?: { toolName?: string; toolPayload?: Record<string, unknown> },
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role,
    content,
    tool_name: toolMeta?.toolName ?? null,
    tool_payload: toolMeta?.toolPayload ?? null,
  });
  if (error) throw error;
}

/**
 * Returned oldest-first, ready to feed straight into the model as conversation
 * history. Excludes "tool" rows on purpose — those are an audit trail of what
 * a tool was called with, not something Gemini's function-call/response
 * pairing can be reconstructed from out of a flat message list. The tool's
 * effect shows up in the assistant's next natural-language reply instead.
 */
export async function getRecentHistory(sessionId: string, limit = 20): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Array<{ role: ChatRole; content: string }>).reverse();
}

export async function getLongTermFacts(email: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("memory_facts")
    .select("fact")
    .eq("email", email)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<{ fact: string }>).map((row) => row.fact);
}

export async function addLongTermFact(
  email: string,
  fact: string,
  sourceSessionId: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase.from("memory_facts").insert({
    email,
    fact,
    source_session_id: sourceSessionId,
  });
  if (error) throw error;
}

/** Called by the lead-gen tool the instant an email is captured — the anonymous-to-known-identity transition. */
export async function linkSessionToEmail(sessionId: string, email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("chat_sessions")
    .update({ lead_email: email })
    .eq("id", sessionId);
  if (error) throw error;
}
