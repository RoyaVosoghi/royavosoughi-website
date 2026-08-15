import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { summarizeMessages } from "./summarize";
import type { Channel, ChatMessage, ChatRole, Locale } from "./types";

export interface Conversation {
  id: string;
  channel: Channel;
  externalUserId: string;
  locale: Locale;
  leadEmail: string | null;
  summary: string | null;
  summaryUpToCount: number;
  contextResetAt: string | null;
  /** Set from the admin inbox (see app/api/admin/conversations/[id]/pause) — while true, runBrainTurn stores the visitor's message but never calls a model, so a human operator's manual replies are the only thing that comes back. */
  botPaused: boolean;
}

const CONVERSATION_COLUMNS =
  "id, channel, external_user_id, locale, lead_email, summary, summary_up_to_count, context_reset_at, bot_paused";

type ConversationRow = {
  id: string;
  channel: Channel;
  external_user_id: string;
  locale: Locale;
  lead_email: string | null;
  summary: string | null;
  summary_up_to_count: number;
  context_reset_at: string | null;
  bot_paused: boolean;
};

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    locale: row.locale,
    leadEmail: row.lead_email,
    summary: row.summary,
    summaryUpToCount: row.summary_up_to_count,
    contextResetAt: row.context_reset_at,
    botPaused: row.bot_paused,
  };
}

/** Read-only lookup — unlike getOrCreateConversation, never creates a row. Used to restore chat history on page load without conjuring an empty conversation for a session id nobody's used yet. */
export async function findConversation(
  channel: Channel,
  externalUserId: string,
): Promise<Conversation | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("channel", channel)
    .eq("external_user_id", externalUserId)
    .maybeSingle();

  if (error) throw error;
  return data ? toConversation(data as ConversationRow) : null;
}

export async function getOrCreateConversation(
  channel: Channel,
  externalUserId: string,
  locale: Locale,
): Promise<Conversation> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { data: existing, error: fetchError } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("channel", channel)
    .eq("external_user_id", externalUserId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    await supabase
      .from("conversations")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", existing.id);
    return toConversation(existing as ConversationRow);
  }

  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({ channel, external_user_id: externalUserId, locale })
    .select(CONVERSATION_COLUMNS)
    .single();

  if (insertError) throw insertError;

  return toConversation(created as ConversationRow);
}

/**
 * Upserts the cross-channel identity registry (unified_users) — called
 * alongside getOrCreateConversation on every turn. `name`, when provided,
 * overwrites any previous value (e.g. once a lead capture reveals a name
 * that wasn't known at first contact). Best-effort: a failure here shouldn't
 * break the actual conversation, so it logs rather than throws.
 */
export async function upsertUnifiedUser(
  channel: Channel,
  externalId: string,
  name?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const row: Record<string, unknown> = { channel, external_id: externalId };
  if (name) row.name = name;

  const { error } = await supabase
    .from("unified_users")
    .upsert(row, { onConflict: "channel,external_id", ignoreDuplicates: !name });

  if (error) console.error("[memory] upsertUnifiedUser failed:", error.message);
}

export interface AppendMessageMeta {
  toolName?: string;
  toolPayload?: Record<string, unknown>;
  modelUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
  retrievedChunkIds?: string[];
}

/** Returns the new message's id — the web/widget channels need it client-side to attach feedback to a specific reply. */
export async function appendMessage(
  conversationId: string,
  role: ChatRole,
  content: string,
  meta?: AppendMessageMeta,
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      tool_name: meta?.toolName ?? null,
      tool_payload: meta?.toolPayload ?? null,
      model_used: meta?.modelUsed ?? null,
      tokens_in: meta?.tokensIn ?? null,
      tokens_out: meta?.tokensOut ?? null,
      retrieved_chunk_ids: meta?.retrievedChunkIds ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  return data.id as string;
}

/**
 * Full history, oldest-first, since `since` if given (Telegram's /reset sets
 * conversations.context_reset_at — everything before it is excluded from
 * what the model sees, though still visible in the admin conversation
 * viewer, which reads messages directly rather than through this function).
 * Excludes "tool" rows on purpose — those are an audit trail of what a tool
 * was called with, not something Gemini's function-call/response pairing can
 * be reconstructed from out of a flat message list. The tool's effect shows
 * up in the assistant's next natural-language reply instead.
 */
export async function getAllHistory(conversationId: string, since?: string | null): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  let query = supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"]);

  if (since) query = query.gt("created_at", since);

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as ChatMessage[];
}

export interface PublicMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** Like getAllHistory, but includes each message's id — needed by app/api/chat/history/route.ts so restored assistant messages can still take feedback (ChatMessage, used for the model's own context, deliberately omits id since Gemini's contents array has no use for it). */
export async function getPublicMessageHistory(
  conversationId: string,
  since?: string | null,
): Promise<PublicMessage[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  let query = supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"]);

  if (since) query = query.gt("created_at", since);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []) as PublicMessage[];
}

/** Backs Telegram's /reset command. Doesn't delete anything — see getAllHistory. */
export async function resetConversationContext(conversationId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("conversations")
    .update({ context_reset_at: new Date().toISOString(), summary: null, summary_up_to_count: 0 })
    .eq("id", conversationId);
  if (error) throw error;
}

/** Called by the widget when it ends a conversation (idle timeout or an explicit close) — see app/api/widget/close-conversation. */
export async function closeConversation(
  conversationId: string,
  reason: "user_closed" | "idle_timeout",
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("conversations")
    .update({ status: "closed", ended_reason: reason })
    .eq("id", conversationId);
  if (error) throw error;
}

/** One rating per conversation — a second call just overwrites the first. */
export async function rateConversation(conversationId: string, rating: number): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("conversations")
    .update({ satisfaction_rating: rating, satisfaction_rated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

/** How many of the most recent messages stay verbatim in the model's context, never summarized away. */
const RECENT_KEEP = 8;

/**
 * No column in the new schema's model_config/embedding_config/prompt_versions
 * has a natural home for "summarize after N messages" — it's a conversation-
 * memory concern, not a model/retrieval/persona one. Kept as a constant
 * rather than forcing it into a table it doesn't conceptually belong to.
 */
const DEFAULT_SUMMARIZE_AFTER_MESSAGES = 16;

export async function updateConversationSummary(
  conversationId: string,
  summary: string,
  upToCount: number,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("conversations")
    .update({ summary, summary_up_to_count: upToCount })
    .eq("id", conversationId);
  if (error) throw error;
}

/**
 * Feeds the model a bounded amount of context regardless of how long a
 * conversation runs: below `summarizeAfterMessages`, the full history goes in
 * verbatim. Past that, only the last `RECENT_KEEP` messages stay verbatim and
 * everything older is folded into a standing summary — regenerated only when
 * new older messages accumulate past what's already summarized
 * (`conversation.summaryUpToCount`), not on every turn.
 */
export async function getConversationContext(
  conversation: Conversation,
  summarizeAfterMessages: number = DEFAULT_SUMMARIZE_AFTER_MESSAGES,
): Promise<{ recent: ChatMessage[]; summary: string | null }> {
  const all = await getAllHistory(conversation.id, conversation.contextResetAt);

  if (all.length <= summarizeAfterMessages) {
    return { recent: all, summary: null };
  }

  const recent = all.slice(-RECENT_KEEP);
  const older = all.slice(0, -RECENT_KEEP);

  if (conversation.summary && conversation.summaryUpToCount >= older.length) {
    return { recent, summary: conversation.summary };
  }

  const summary = await summarizeMessages(older, conversation.summary);
  if (summary) await updateConversationSummary(conversation.id, summary, older.length);
  return { recent, summary: summary || conversation.summary };
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
  sourceConversationId: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase.from("memory_facts").insert({
    email,
    fact,
    source_session_id: sourceConversationId,
  });
  if (error) throw error;
}

/** Called by the lead-gen tool the instant an email is captured — the anonymous-to-known-identity transition. */
export async function linkConversationToEmail(conversationId: string, email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("conversations")
    .update({ lead_email: email })
    .eq("id", conversationId);
  if (error) throw error;
}
