import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { summarizeMessages } from "./summarize";
import type { Channel, ChatMessage, ChatRole, Locale } from "./types";

export interface ChatSession {
  id: string;
  channel: Channel;
  channelSessionId: string;
  locale: Locale;
  leadEmail: string | null;
  summary: string | null;
  summaryUpToCount: number;
}

const SESSION_COLUMNS =
  "id, channel, channel_session_id, locale, lead_email, summary, summary_up_to_count";

type SessionRow = {
  id: string;
  channel: Channel;
  channel_session_id: string;
  locale: Locale;
  lead_email: string | null;
  summary: string | null;
  summary_up_to_count: number;
};

function toSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    channel: row.channel,
    channelSessionId: row.channel_session_id,
    locale: row.locale,
    leadEmail: row.lead_email,
    summary: row.summary,
    summaryUpToCount: row.summary_up_to_count,
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
    .select(SESSION_COLUMNS)
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
    .select(SESSION_COLUMNS)
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
 * Full history, oldest-first. Excludes "tool" rows on purpose — those are an
 * audit trail of what a tool was called with, not something Gemini's
 * function-call/response pairing can be reconstructed from out of a flat
 * message list. The tool's effect shows up in the assistant's next
 * natural-language reply instead.
 */
async function getAllHistory(sessionId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as ChatMessage[];
}

/** How many of the most recent messages stay verbatim in the model's context, never summarized away. */
const RECENT_KEEP = 8;

export async function updateSessionSummary(
  sessionId: string,
  summary: string,
  upToCount: number,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("chat_sessions")
    .update({ summary, summary_up_to_count: upToCount })
    .eq("id", sessionId);
  if (error) throw error;
}

/**
 * Feeds the model a bounded amount of context regardless of how long a
 * conversation runs: below `summarizeAfterMessages`, the full history goes in
 * verbatim (unchanged from before this existed). Past that, only the last
 * `RECENT_KEEP` messages stay verbatim and everything older is folded into a
 * standing summary — regenerated only when new older messages accumulate
 * past what's already summarized (`session.summaryUpToCount`), not on every
 * turn.
 */
export async function getConversationContext(
  session: ChatSession,
  summarizeAfterMessages: number,
): Promise<{ recent: ChatMessage[]; summary: string | null }> {
  const all = await getAllHistory(session.id);

  if (all.length <= summarizeAfterMessages) {
    return { recent: all, summary: null };
  }

  const recent = all.slice(-RECENT_KEEP);
  const older = all.slice(0, -RECENT_KEEP);

  if (session.summary && session.summaryUpToCount >= older.length) {
    return { recent, summary: session.summary };
  }

  const summary = await summarizeMessages(older, session.summary);
  if (summary) await updateSessionSummary(session.id, summary, older.length);
  return { recent, summary: summary || session.summary };
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
