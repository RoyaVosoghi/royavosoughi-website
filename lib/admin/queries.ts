import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface Lead {
  id: string;
  name: string;
  email: string;
  interest: string | null;
  source: string | null;
  conversationId: string | null;
  locale: string;
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
}

export interface MessageRow {
  id: string;
  role: string;
  content: string;
  toolName: string | null;
  modelUsed: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
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
    .select("id, name, email, interest, source, conversation_id, locale, created_at")
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
    createdAt: row.created_at,
  }));
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

export async function getConversations(limit = 100): Promise<ConversationSummary[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, channel, external_user_id, status, locale, lead_email, started_at, last_active_at")
    .order("last_active_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    status: row.status,
    locale: row.locale,
    leadEmail: row.lead_email,
    startedAt: row.started_at,
    lastActiveAt: row.last_active_at,
  }));
}

export async function getConversation(id: string): Promise<ConversationSummary | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, channel, external_user_id, status, locale, lead_email, started_at, last_active_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    channel: data.channel,
    externalUserId: data.external_user_id,
    status: data.status,
    locale: data.locale,
    leadEmail: data.lead_email,
    startedAt: data.started_at,
    lastActiveAt: data.last_active_at,
  };
}

export async function closeConversation(id: string, status: "active" | "closed"): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("conversations").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function getConversationMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, tool_name, model_used, tokens_in, tokens_out, created_at")
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
    createdAt: row.created_at,
  }));
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

/** There's no per-admin login yet (one shared password), so every /admin action attributes to whichever admin_users row was seeded first. */
export async function getSeededAdminUserId(): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data } = await supabase.from("admin_users").select("id").limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function writeAuditLog(action: string, target?: string | null): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const adminUserId = await getSeededAdminUserId();

  const { error } = await supabase.from("audit_log").insert({
    admin_user_id: adminUserId,
    action,
    target: target ?? null,
  });
  if (error) console.error("[admin] writeAuditLog failed:", error.message);
}
