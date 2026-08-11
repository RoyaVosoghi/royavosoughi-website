import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface Lead {
  id: string;
  name: string;
  email: string;
  interest: string | null;
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

export interface ChatSessionSummary {
  id: string;
  channel: string;
  channelSessionId: string;
  locale: string;
  leadEmail: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export interface ChatMessageRow {
  id: string;
  role: string;
  content: string;
  toolName: string | null;
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

export interface DashboardStats {
  leadsCount: number;
  registrationsCount: number;
  kbChunksCount: number;
  openHandoffsCount: number;
  sessionsByChannel: Record<string, number>;
}

function requireClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = requireClient();

  const [leads, registrations, kbChunks, openHandoffs, web, telegram, widget] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    supabase.from("kb_chunks").select("*", { count: "exact", head: true }),
    supabase
      .from("handoff_requests")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false),
    supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true })
      .eq("channel", "web"),
    supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true })
      .eq("channel", "telegram"),
    supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true })
      .eq("channel", "widget"),
  ]);

  return {
    leadsCount: leads.count ?? 0,
    registrationsCount: registrations.count ?? 0,
    kbChunksCount: kbChunks.count ?? 0,
    openHandoffsCount: openHandoffs.count ?? 0,
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
    .select("id, name, email, interest, locale, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    interest: row.interest,
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

export async function getSessions(limit = 100): Promise<ChatSessionSummary[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, channel, channel_session_id, locale, lead_email, created_at, last_active_at")
    .order("last_active_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    channelSessionId: row.channel_session_id,
    locale: row.locale,
    leadEmail: row.lead_email,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  }));
}

export async function getSession(id: string): Promise<ChatSessionSummary | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, channel, channel_session_id, locale, lead_email, created_at, last_active_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    channel: data.channel,
    channelSessionId: data.channel_session_id,
    locale: data.locale,
    leadEmail: data.lead_email,
    createdAt: data.created_at,
    lastActiveAt: data.last_active_at,
  };
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessageRow[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_name, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    toolName: row.tool_name,
    createdAt: row.created_at,
  }));
}
