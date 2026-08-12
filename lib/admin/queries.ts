import "server-only";

import { getCurrentAdmin, hashPassword, type AdminRole } from "@/lib/admin/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export interface Lead {
  id: string;
  name: string;
  email: string;
  interest: string | null;
  source: string | null;
  conversationId: string | null;
  locale: string;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
}

export interface Registration {
  id: string;
  name: string;
  email: string;
  eventType: string;
  status: string;
  locale: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  channel: string;
  externalUserId: string;
  status: string;
  locale: string;
  leadEmail: string | null;
  startedAt: string;
  lastActiveAt: string;
  botPaused: boolean;
  flagged: boolean;
}

export interface MessageRow {
  id: string;
  role: string;
  content: string;
  toolName: string | null;
  modelUsed: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  retrievedChunkIds: string[] | null;
  createdAt: string;
}

export interface RetrievedSource {
  id: string;
  documentTitle: string;
  content: string;
}

export interface HandoffRequest {
  id: string;
  reason: string;
  note: string | null;
  sessionId: string | null;
  locale: string;
  resolved: boolean;
  createdAt: string;
}

export interface UnifiedUser {
  id: string;
  channel: string;
  externalId: string;
  name: string | null;
  firstSeen: string;
}

export interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  messageContent: string;
  conversationId: string | null;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  adminEmail: string | null;
  action: string;
  target: string | null;
  createdAt: string;
}

export interface DashboardStats {
  leadsCount: number;
  registrationsCount: number;
  documentsCount: number;
  chunksCount: number;
  openHandoffsCount: number;
  unifiedUsersCount: number;
  sessionsByChannel: Record<string, number>;
}

function requireClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = requireClient();

  const [leads, registrations, documents, chunks, openHandoffs, unifiedUsers, web, telegram, widget] =
    await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("registrations").select("*", { count: "exact", head: true }),
      supabase.from("documents").select("*", { count: "exact", head: true }),
      supabase.from("chunks").select("*", { count: "exact", head: true }),
      supabase.from("handoff_requests").select("*", { count: "exact", head: true }).eq("resolved", false),
      supabase.from("unified_users").select("*", { count: "exact", head: true }),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("channel", "web"),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("channel", "telegram"),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("channel", "widget"),
    ]);

  return {
    leadsCount: leads.count ?? 0,
    registrationsCount: registrations.count ?? 0,
    documentsCount: documents.count ?? 0,
    chunksCount: chunks.count ?? 0,
    openHandoffsCount: openHandoffs.count ?? 0,
    unifiedUsersCount: unifiedUsers.count ?? 0,
    sessionsByChannel: {
      web: web.count ?? 0,
      telegram: telegram.count ?? 0,
      widget: widget.count ?? 0,
    },
  };
}

export async function getHandoffRequests(limit = 100): Promise<HandoffRequest[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("handoff_requests")
    .select("id, reason, note, session_id, locale, resolved, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    reason: row.reason,
    note: row.note,
    sessionId: row.session_id,
    locale: row.locale,
    resolved: row.resolved,
    createdAt: row.created_at,
  }));
}

export async function resolveHandoffRequest(id: string, resolved: boolean): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("handoff_requests").update({ resolved }).eq("id", id);
  if (error) throw error;
}

export async function getLeads(limit = 100): Promise<Lead[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, email, interest, source, conversation_id, locale, status, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    interest: row.interest,
    source: row.source,
    conversationId: row.conversation_id,
    locale: row.locale,
    status: (row.status ?? "new") as LeadStatus,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function updateLead(id: string, update: { status?: LeadStatus; notes?: string | null }): Promise<void> {
  const supabase = requireClient();
  const patch: Record<string, unknown> = {};
  if (update.status !== undefined) patch.status = update.status;
  if (update.notes !== undefined) patch.notes = update.notes;
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) throw error;
}

export async function getRegistrations(limit = 100): Promise<Registration[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("id, name, email, event_type, status, locale, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    eventType: row.event_type,
    status: row.status,
    locale: row.locale,
    createdAt: row.created_at,
  }));
}

const CONVERSATION_SUMMARY_COLUMNS =
  "id, channel, external_user_id, status, locale, lead_email, started_at, last_active_at, bot_paused, flagged";

function toConversationSummary(row: {
  id: string;
  channel: string;
  external_user_id: string;
  status: string;
  locale: string;
  lead_email: string | null;
  started_at: string;
  last_active_at: string;
  bot_paused: boolean;
  flagged: boolean;
}): ConversationSummary {
  return {
    id: row.id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    status: row.status,
    locale: row.locale,
    leadEmail: row.lead_email,
    startedAt: row.started_at,
    lastActiveAt: row.last_active_at,
    botPaused: row.bot_paused,
    flagged: row.flagged,
  };
}

export interface ConversationFilters {
  channel?: "web" | "telegram" | "widget";
  status?: "active" | "closed";
  flagged?: boolean;
  /** Matches against lead_email or external_user_id. */
  search?: string;
}

export async function getConversations(filters: ConversationFilters = {}, limit = 200): Promise<ConversationSummary[]> {
  const supabase = requireClient();
  let query = supabase.from("conversations").select(CONVERSATION_SUMMARY_COLUMNS);

  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.flagged !== undefined) query = query.eq("flagged", filters.flagged);
  if (filters.search) {
    const term = filters.search.trim();
    query = query.or(`lead_email.ilike.%${term}%,external_user_id.ilike.%${term}%`);
  }

  const { data, error } = await query.order("last_active_at", { ascending: false }).limit(limit);

  if (error) throw error;

  return (data ?? []).map(toConversationSummary);
}

export async function getConversation(id: string): Promise<ConversationSummary | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SUMMARY_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return toConversationSummary(data);
}

export async function closeConversation(id: string, status: "active" | "closed"): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("conversations").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setConversationPaused(id: string, paused: boolean): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("conversations").update({ bot_paused: paused }).eq("id", id);
  if (error) throw error;
}

export async function setConversationFlagged(id: string, flagged: boolean): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("conversations").update({ flagged }).eq("id", id);
  if (error) throw error;
}

export async function getConversationMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, tool_name, model_used, tokens_in, tokens_out, retrieved_chunk_ids, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    toolName: row.tool_name,
    modelUsed: row.model_used,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    retrievedChunkIds: row.retrieved_chunk_ids,
    createdAt: row.created_at,
  }));
}

/** Resolves a batch of chunk ids to their content + document title, for the conversation detail view's "sources used" panel. */
export async function getSourcesForChunkIds(chunkIds: string[]): Promise<Map<string, RetrievedSource>> {
  const map = new Map<string, RetrievedSource>();
  if (chunkIds.length === 0) return map;

  const supabase = requireClient();
  const { data, error } = await supabase
    .from("chunks")
    .select("id, content, documents(title)")
    .in("id", chunkIds);

  if (error) throw error;

  for (const row of (data ?? []) as Array<{ id: string; content: string; documents: { title: string } | { title: string }[] | null }>) {
    const doc = Array.isArray(row.documents) ? row.documents[0] : row.documents;
    map.set(row.id, { id: row.id, documentTitle: doc?.title ?? "unknown", content: row.content });
  }

  return map;
}

/** Appends a manual reply from a human operator — persisted the same as a model reply (model_used records who/what actually answered), and pushed out over the channel's own delivery mechanism (Telegram needs an explicit send; web/widget are picked up by the client's poll against /api/chat/history or /api/widget/history). */
export async function sendManualReply(conversationId: string, content: string): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "assistant", content, model_used: "human-operator" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getUnifiedUsers(limit = 100): Promise<UnifiedUser[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("unified_users")
    .select("id, channel, external_id, name, first_seen")
    .order("first_seen", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    externalId: row.external_id,
    name: row.name,
    firstSeen: row.first_seen,
  }));
}

export async function getFeedback(limit = 100): Promise<FeedbackRow[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("id, rating, comment, created_at, messages(content, conversation_id)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const message = Array.isArray(row.messages) ? row.messages[0] : row.messages;
    return {
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      messageContent: message?.content ?? "(message no longer available)",
      conversationId: message?.conversation_id ?? null,
      createdAt: row.created_at,
    };
  });
}

export interface UnansweredQuestion {
  messageId: string;
  conversationId: string;
  question: string | null;
  reply: string;
  createdAt: string;
}

/** Assistant replies where retrieval found nothing to ground the answer in — the clearest available signal that the knowledge base is missing something, short of a real "I don't know" classifier. Scans the most recent 300 assistant messages and resolves each candidate's preceding question with a follow-up query, which is fine at this site's traffic but wouldn't scale to a high-volume bot. */
export async function getUnansweredQuestions(limit = 30): Promise<UnansweredQuestion[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, content, retrieved_chunk_ids, created_at")
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const candidates = (
    (data ?? []) as Array<{
      id: string;
      conversation_id: string;
      content: string;
      retrieved_chunk_ids: string[] | null;
      created_at: string;
    }>
  )
    .filter((row) => !row.retrieved_chunk_ids || row.retrieved_chunk_ids.length === 0)
    .slice(0, limit);

  const results: UnansweredQuestion[] = [];
  for (const c of candidates) {
    const { data: prevUser } = await supabase
      .from("messages")
      .select("content")
      .eq("conversation_id", c.conversation_id)
      .eq("role", "user")
      .lt("created_at", c.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    results.push({
      messageId: c.id,
      conversationId: c.conversation_id,
      question: prevUser?.content ?? null,
      reply: c.content,
      createdAt: c.created_at,
    });
  }
  return results;
}

export async function getAuditLog(limit = 100): Promise<AuditLogRow[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, target, created_at, admin_users(email)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const admin = Array.isArray(row.admin_users) ? row.admin_users[0] : row.admin_users;
    return {
      id: row.id,
      adminEmail: admin?.email ?? null,
      action: row.action,
      target: row.target,
      createdAt: row.created_at,
    };
  });
}

export async function getTelegramRecipients(): Promise<string[]> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("unified_users").select("external_id").eq("channel", "telegram");
  if (error) throw error;
  return (data ?? []).map((row) => row.external_id as string);
}

/** Attributes to whichever admin is behind the current session cookie — call from within a request (route handler/server action), never from a background job. */
export interface AdminUserRow {
  id: string;
  email: string;
  role: AdminRole;
  hasPassword: boolean;
  createdAt: string;
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, role, password_hash, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as AdminRole,
    hasPassword: Boolean(row.password_hash),
    createdAt: row.created_at,
  }));
}

export async function createAdminUser(email: string, password: string, role: AdminRole): Promise<void> {
  const supabase = requireClient();
  const passwordHash = await hashPassword(password);
  const { error } = await supabase
    .from("admin_users")
    .insert({ email: email.trim(), role, password_hash: passwordHash });
  if (error) throw error;
}

export async function updateAdminUserRole(id: string, role: AdminRole): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("admin_users").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function resetAdminUserPassword(id: string, password: string): Promise<void> {
  const supabase = requireClient();
  const passwordHash = await hashPassword(password);
  const { error } = await supabase.from("admin_users").update({ password_hash: passwordHash }).eq("id", id);
  if (error) throw error;
}

export async function deleteAdminUser(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("admin_users").delete().eq("id", id);
  if (error) throw error;
}

export async function writeAuditLog(action: string, target?: string | null): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const admin = await getCurrentAdmin();

  const { error } = await supabase.from("audit_log").insert({
    admin_user_id: admin?.id ?? null,
    action,
    target: target ?? null,
  });
  if (error) console.error("[admin] writeAuditLog failed:", error.message);
}
