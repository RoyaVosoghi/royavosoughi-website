import "server-only";

import { toJalaali } from "jalaali-js";

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
  companyName: string | null;
  aiScore: number | null;
  aiScoreReason: string | null;
  aiScoreUpdatedAt: string | null;
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

const LEAD_COLUMNS =
  "id, name, email, interest, source, conversation_id, locale, status, notes, company_name, ai_score, ai_score_reason, ai_score_updated_at, created_at";

function toLead(row: {
  id: string;
  name: string;
  email: string;
  interest: string | null;
  source: string | null;
  conversation_id: string | null;
  locale: string;
  status: string | null;
  notes: string | null;
  company_name: string | null;
  ai_score: number | null;
  ai_score_reason: string | null;
  ai_score_updated_at: string | null;
  created_at: string;
}): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    interest: row.interest,
    source: row.source,
    conversationId: row.conversation_id,
    locale: row.locale,
    status: (row.status ?? "new") as LeadStatus,
    notes: row.notes,
    companyName: row.company_name,
    aiScore: row.ai_score,
    aiScoreReason: row.ai_score_reason,
    aiScoreUpdatedAt: row.ai_score_updated_at,
    createdAt: row.created_at,
  };
}

export async function getLeads(limit = 100): Promise<Lead[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map(toLead);
}

export async function getLead(id: string): Promise<Lead | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toLead(data) : null;
}

export async function updateLead(
  id: string,
  update: { status?: LeadStatus; notes?: string | null; companyName?: string | null },
): Promise<void> {
  const supabase = requireClient();
  const patch: Record<string, unknown> = {};
  if (update.status !== undefined) patch.status = update.status;
  if (update.notes !== undefined) patch.notes = update.notes;
  if (update.companyName !== undefined) patch.company_name = update.companyName;
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateLeadAiScore(id: string, result: { score: number; reason: string }): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("leads")
    .update({
      ai_score: result.score,
      ai_score_reason: result.reason,
      ai_score_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
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

// -----------------------------------------------------------------------------
// CRM: pipeline stages
// -----------------------------------------------------------------------------

export interface PipelineStage {
  id: string;
  name: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  color: string | null;
  createdAt: string;
}

const PIPELINE_STAGE_COLUMNS = "id, name, sort_order, is_won, is_lost, color, created_at";

function toPipelineStage(row: {
  id: string;
  name: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  color: string | null;
  created_at: string;
}): PipelineStage {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isWon: row.is_won,
    isLost: row.is_lost,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select(PIPELINE_STAGE_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toPipelineStage);
}

export async function createPipelineStage(input: {
  name: string;
  sortOrder?: number;
  isWon?: boolean;
  isLost?: boolean;
  color?: string | null;
}): Promise<PipelineStage> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({
      name: input.name,
      sort_order: input.sortOrder ?? 0,
      is_won: input.isWon ?? false,
      is_lost: input.isLost ?? false,
      color: input.color ?? null,
    })
    .select(PIPELINE_STAGE_COLUMNS)
    .single();
  if (error) throw error;
  return toPipelineStage(data);
}

export async function updatePipelineStage(
  id: string,
  patch: { name?: string; sortOrder?: number; isWon?: boolean; isLost?: boolean; color?: string | null },
): Promise<void> {
  const supabase = requireClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder;
  if (patch.isWon !== undefined) dbPatch.is_won = patch.isWon;
  if (patch.isLost !== undefined) dbPatch.is_lost = patch.isLost;
  if (patch.color !== undefined) dbPatch.color = patch.color;
  const { error } = await supabase.from("pipeline_stages").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function reorderPipelineStages(orderedIds: string[]): Promise<void> {
  const supabase = requireClient();
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("pipeline_stages").update({ sort_order: index }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** Thrown by deletePipelineStage when deals still reference it — deals.pipeline_stage_id is ON DELETE RESTRICT, so the caller must reassign those deals first. Routes should map this to a 409. */
export class PipelineStageInUseError extends Error {
  constructor(public dealCount: number) {
    super("pipeline_stage_in_use");
  }
}

export async function deletePipelineStage(id: string): Promise<void> {
  const supabase = requireClient();
  const { count, error: countError } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("pipeline_stage_id", id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new PipelineStageInUseError(count ?? 0);

  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// CRM: companies
// -----------------------------------------------------------------------------

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  notes: string | null;
  createdAt: string;
}

const COMPANY_COLUMNS = "id, name, domain, industry, notes, created_at";

function toCompany(row: {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
}): Company {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function getCompanies(limit = 200): Promise<Company[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .order("name", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toCompany);
}

export async function getCompany(id: string): Promise<Company | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCompany(data) : null;
}

export async function createCompany(input: {
  name: string;
  domain?: string | null;
  industry?: string | null;
  notes?: string | null;
}): Promise<Company> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: input.name,
      domain: input.domain ?? null,
      industry: input.industry ?? null,
      notes: input.notes ?? null,
    })
    .select(COMPANY_COLUMNS)
    .single();
  if (error) throw error;
  return toCompany(data);
}

/** Case-insensitive match on name — the convert-time helper, so "Acme Inc" and "acme inc" dedupe to one company. */
export async function findOrCreateCompanyByName(name: string): Promise<Company> {
  const supabase = requireClient();
  const trimmed = name.trim();

  const { data: existing, error: findError } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .ilike("name", trimmed)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return toCompany(existing);

  const { data, error } = await supabase
    .from("companies")
    .insert({ name: trimmed })
    .select(COMPANY_COLUMNS)
    .single();
  if (error) throw error;
  return toCompany(data);
}

export async function updateCompany(
  id: string,
  patch: { name?: string; domain?: string | null; industry?: string | null; notes?: string | null },
): Promise<void> {
  const supabase = requireClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.domain !== undefined) dbPatch.domain = patch.domain;
  if (patch.industry !== undefined) dbPatch.industry = patch.industry;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  const { error } = await supabase.from("companies").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteCompany(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// CRM: contacts — the real, editable CRM record. Distinct from `unified_users`
// (chat-identity registry, see /admin/identities).
// -----------------------------------------------------------------------------

export type ContactStatus = "active" | "customer" | "inactive";

export interface Contact {
  id: string;
  leadId: string | null;
  companyId: string | null;
  companyName: string | null;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  status: ContactStatus;
  source: string | null;
  locale: string;
  aiSummary: string | null;
  aiSummaryUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONTACT_COLUMNS =
  "id, lead_id, company_id, name, email, phone, title, status, source, locale, ai_summary, ai_summary_updated_at, created_at, updated_at, companies(name)";

function toContact(row: {
  id: string;
  lead_id: string | null;
  company_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  status: string;
  source: string | null;
  locale: string;
  ai_summary: string | null;
  ai_summary_updated_at: string | null;
  created_at: string;
  updated_at: string;
  companies: { name: string } | { name: string }[] | null;
}): Contact {
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  return {
    id: row.id,
    leadId: row.lead_id,
    companyId: row.company_id,
    companyName: company?.name ?? null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    title: row.title,
    status: row.status as ContactStatus,
    source: row.source,
    locale: row.locale,
    aiSummary: row.ai_summary,
    aiSummaryUpdatedAt: row.ai_summary_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getContacts(filters: { companyId?: string } = {}, limit = 200): Promise<Contact[]> {
  const supabase = requireClient();
  let query = supabase.from("contacts").select(CONTACT_COLUMNS);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(toContact);
}

export async function getContact(id: string): Promise<Contact | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("contacts").select(CONTACT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toContact(data) : null;
}

export async function createContact(input: {
  leadId?: string | null;
  companyId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  status?: ContactStatus;
  source?: string | null;
  locale?: string;
}): Promise<Contact> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      lead_id: input.leadId ?? null,
      company_id: input.companyId ?? null,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      title: input.title ?? null,
      status: input.status ?? "active",
      source: input.source ?? null,
      locale: input.locale ?? "en",
    })
    .select(CONTACT_COLUMNS)
    .single();
  if (error) throw error;
  return toContact(data);
}

/** When `status` changes, also drops a system 'note' activity so the change shows up in the contact's timeline — there's no separate history table. */
export async function updateContact(
  id: string,
  patch: { companyId?: string | null; name?: string; phone?: string | null; title?: string | null; status?: ContactStatus },
): Promise<void> {
  const supabase = requireClient();

  let previousStatus: ContactStatus | null = null;
  if (patch.status !== undefined) {
    const { data: current } = await supabase.from("contacts").select("status").eq("id", id).maybeSingle();
    previousStatus = (current?.status as ContactStatus) ?? null;
  }

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.companyId !== undefined) dbPatch.company_id = patch.companyId;
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.status !== undefined) dbPatch.status = patch.status;

  const { error } = await supabase.from("contacts").update(dbPatch).eq("id", id);
  if (error) throw error;

  if (patch.status !== undefined && previousStatus && previousStatus !== patch.status) {
    await supabase.from("activities").insert({
      contact_id: id,
      type: "note",
      subject: `Stage changed: ${previousStatus} → ${patch.status}`,
    });
  }
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

export async function updateContactAiSummary(id: string, summary: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("contacts")
    .update({ ai_summary: summary, ai_summary_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Owns the whole Lead -> Contact convert side effect: find-or-create the company (from the explicit opts.companyName, falling back to whatever the lead itself captured), insert the contact, flip the lead to 'converted'. */
export async function convertLeadToContact(leadId: string, opts: { companyName?: string | null } = {}): Promise<Contact> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("lead_not_found");

  const companyName = opts.companyName?.trim() || lead.companyName?.trim() || null;
  const company = companyName ? await findOrCreateCompanyByName(companyName) : null;

  const contact = await createContact({
    leadId: lead.id,
    companyId: company?.id ?? null,
    name: lead.name,
    email: lead.email,
    source: lead.source,
    locale: lead.locale,
  });

  await updateLead(leadId, { status: "converted" });

  return contact;
}

// -----------------------------------------------------------------------------
// CRM: deals — one Kanban card each.
// -----------------------------------------------------------------------------

export type DealStatus = "open" | "won" | "lost";

export interface Deal {
  id: string;
  contactId: string;
  companyId: string | null;
  pipelineStageId: string;
  title: string;
  amountCents: number;
  currency: string;
  status: DealStatus;
  expectedCloseDate: string | null;
  closedAt: string | null;
  aiNextAction: string | null;
  aiNextActionUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealWithRelations extends Deal {
  contactName: string;
  companyName: string | null;
  stageName: string;
}

const DEAL_COLUMNS =
  "id, contact_id, company_id, pipeline_stage_id, title, amount_cents, currency, status, expected_close_date, closed_at, ai_next_action, ai_next_action_updated_at, created_at, updated_at";

function toDeal(row: {
  id: string;
  contact_id: string;
  company_id: string | null;
  pipeline_stage_id: string;
  title: string;
  amount_cents: number;
  currency: string;
  status: string;
  expected_close_date: string | null;
  closed_at: string | null;
  ai_next_action: string | null;
  ai_next_action_updated_at: string | null;
  created_at: string;
  updated_at: string;
}): Deal {
  return {
    id: row.id,
    contactId: row.contact_id,
    companyId: row.company_id,
    pipelineStageId: row.pipeline_stage_id,
    title: row.title,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status as DealStatus,
    expectedCloseDate: row.expected_close_date,
    closedAt: row.closed_at,
    aiNextAction: row.ai_next_action,
    aiNextActionUpdatedAt: row.ai_next_action_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DealFilters {
  pipelineStageId?: string;
  contactId?: string;
  status?: DealStatus;
}

export async function getDeals(filters: DealFilters = {}, limit = 500): Promise<DealWithRelations[]> {
  const supabase = requireClient();
  let query = supabase.from("deals").select(`${DEAL_COLUMNS}, contacts(name), companies(name), pipeline_stages(name)`);

  if (filters.pipelineStageId) query = query.eq("pipeline_stage_id", filters.pipelineStageId);
  if (filters.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;

  return (
    (data ?? []) as Array<
      Parameters<typeof toDeal>[0] & {
        contacts: { name: string } | { name: string }[] | null;
        companies: { name: string } | { name: string }[] | null;
        pipeline_stages: { name: string } | { name: string }[] | null;
      }
    >
  ).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const stage = Array.isArray(row.pipeline_stages) ? row.pipeline_stages[0] : row.pipeline_stages;
    return {
      ...toDeal(row),
      contactName: contact?.name ?? "—",
      companyName: company?.name ?? null,
      stageName: stage?.name ?? "—",
    };
  });
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("deals").select(DEAL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toDeal(data) : null;
}

export async function createDeal(input: {
  contactId: string;
  companyId?: string | null;
  pipelineStageId: string;
  title: string;
  amountCents?: number;
  currency?: string;
  expectedCloseDate?: string | null;
}): Promise<Deal> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      contact_id: input.contactId,
      company_id: input.companyId ?? null,
      pipeline_stage_id: input.pipelineStageId,
      title: input.title,
      amount_cents: input.amountCents ?? 0,
      currency: input.currency ?? "USD",
      expected_close_date: input.expectedCloseDate ?? null,
    })
    .select(DEAL_COLUMNS)
    .single();
  if (error) throw error;
  return toDeal(data);
}

/** When `pipelineStageId` moves the deal into a won/lost-flagged stage, also sets status + closed_at — one function owns the whole side effect, same approach as updateContact's stage-change note. */
export async function updateDeal(
  id: string,
  patch: { pipelineStageId?: string; title?: string; amountCents?: number; currency?: string; expectedCloseDate?: string | null },
): Promise<void> {
  const supabase = requireClient();
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.pipelineStageId !== undefined) {
    dbPatch.pipeline_stage_id = patch.pipelineStageId;
    const { data: stage, error: stageError } = await supabase
      .from("pipeline_stages")
      .select("is_won, is_lost")
      .eq("id", patch.pipelineStageId)
      .single();
    if (stageError) throw stageError;
    if (stage.is_won) {
      dbPatch.status = "won";
      dbPatch.closed_at = new Date().toISOString();
    } else if (stage.is_lost) {
      dbPatch.status = "lost";
      dbPatch.closed_at = new Date().toISOString();
    } else {
      dbPatch.status = "open";
      dbPatch.closed_at = null;
    }
  }
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.amountCents !== undefined) dbPatch.amount_cents = patch.amountCents;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.expectedCloseDate !== undefined) dbPatch.expected_close_date = patch.expectedCloseDate;

  const { error } = await supabase.from("deals").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteDeal(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDealAiNextAction(id: string, text: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("deals")
    .update({ ai_next_action: text, ai_next_action_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// CRM: activities — calls/meetings/notes/tasks against a contact, optionally
// tied to a specific deal.
// -----------------------------------------------------------------------------

export type ActivityType = "call" | "meeting" | "note" | "task";

export interface Activity {
  id: string;
  contactId: string;
  dealId: string | null;
  type: ActivityType;
  subject: string;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

const ACTIVITY_COLUMNS = "id, contact_id, deal_id, type, subject, body, due_at, completed_at, created_by, created_at";

function toActivity(row: {
  id: string;
  contact_id: string;
  deal_id: string | null;
  type: string;
  subject: string;
  body: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}): Activity {
  return {
    id: row.id,
    contactId: row.contact_id,
    dealId: row.deal_id,
    type: row.type as ActivityType,
    subject: row.subject,
    body: row.body,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export interface ActivityFilters {
  contactId?: string;
  dealId?: string;
  overdueOnly?: boolean;
  type?: ActivityType;
}

export async function getActivities(filters: ActivityFilters = {}, limit = 200): Promise<Activity[]> {
  const supabase = requireClient();
  let query = supabase.from("activities").select(ACTIVITY_COLUMNS);

  if (filters.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters.dealId) query = query.eq("deal_id", filters.dealId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.overdueOnly) query = query.is("completed_at", null).lt("due_at", new Date().toISOString());

  const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(toActivity);
}

export async function createActivity(input: {
  contactId: string;
  dealId?: string | null;
  type: ActivityType;
  subject: string;
  body?: string | null;
  dueAt?: string | null;
}): Promise<Activity> {
  const supabase = requireClient();
  const admin = await getCurrentAdmin();
  const { data, error } = await supabase
    .from("activities")
    .insert({
      contact_id: input.contactId,
      deal_id: input.dealId ?? null,
      type: input.type,
      subject: input.subject,
      body: input.body ?? null,
      due_at: input.dueAt ?? null,
      created_by: admin?.id ?? null,
    })
    .select(ACTIVITY_COLUMNS)
    .single();
  if (error) throw error;
  return toActivity(data);
}

export async function completeActivity(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("activities").update({ completed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function updateActivity(
  id: string,
  patch: { subject?: string; body?: string | null; dueAt?: string | null },
): Promise<void> {
  const supabase = requireClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.subject !== undefined) dbPatch.subject = patch.subject;
  if (patch.body !== undefined) dbPatch.body = patch.body;
  if (patch.dueAt !== undefined) dbPatch.due_at = patch.dueAt;
  const { error } = await supabase.from("activities").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw error;
}

export interface ActivityWithContact extends Activity {
  contactName: string;
}

/** For the global /admin/activities list — joins the contact's name, unlike getActivities() which is used in scoped (already-know-the-contact) contexts. */
export async function getActivitiesWithContact(filters: ActivityFilters = {}, limit = 200): Promise<ActivityWithContact[]> {
  const supabase = requireClient();
  let query = supabase.from("activities").select(`${ACTIVITY_COLUMNS}, contacts(name)`);

  if (filters.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters.dealId) query = query.eq("deal_id", filters.dealId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.overdueOnly) query = query.is("completed_at", null).lt("due_at", new Date().toISOString());

  const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false }).limit(limit);
  if (error) throw error;

  return (
    (data ?? []) as Array<Parameters<typeof toActivity>[0] & { contacts: { name: string } | { name: string }[] | null }>
  ).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    return { ...toActivity(row), contactName: contact?.name ?? "—" };
  });
}

// -----------------------------------------------------------------------------
// CRM: contact 360 timeline — merges activities + conversations (matched by
// lead_email), newest first. Conversations link into the existing
// /admin/conversations/[id] page rather than re-rendering chat inline.
// -----------------------------------------------------------------------------

export type TimelineItem =
  | ({ kind: "activity" } & Activity)
  | { kind: "conversation"; id: string; channel: string; startedAt: string; lastActiveAt: string };

export async function getContactTimeline(contactId: string): Promise<TimelineItem[]> {
  const supabase = requireClient();

  const contact = await getContact(contactId);
  if (!contact) return [];

  const [activitiesResult, conversationsResult] = await Promise.all([
    supabase.from("activities").select(ACTIVITY_COLUMNS).eq("contact_id", contactId),
    supabase.from("conversations").select("id, channel, started_at, last_active_at").eq("lead_email", contact.email),
  ]);
  if (activitiesResult.error) throw activitiesResult.error;
  if (conversationsResult.error) throw conversationsResult.error;

  const activityItems: TimelineItem[] = (activitiesResult.data ?? []).map((row) => ({
    kind: "activity" as const,
    ...toActivity(row),
  }));

  const conversationItems: TimelineItem[] = (conversationsResult.data ?? []).map((row) => ({
    kind: "conversation" as const,
    id: row.id,
    channel: row.channel,
    startedAt: row.started_at,
    lastActiveAt: row.last_active_at,
  }));

  return [...activityItems, ...conversationItems].sort((a, b) => {
    const aTime = a.kind === "activity" ? a.createdAt : a.lastActiveAt;
    const bTime = b.kind === "activity" ? b.createdAt : b.lastActiveAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

// -----------------------------------------------------------------------------
// CRM: AI usage log — lead scoring / contact summaries / deal next-action
// calls don't go through the chat `messages` table, so without this they'd
// be invisible to lib/ai/budget.ts's getMonthlySpend(). Fails soft, like
// writeAuditLog — a logging failure must never break the caller.
// -----------------------------------------------------------------------------

export type AiUsagePurpose = "lead_score" | "contact_summary" | "deal_next_action";

export async function logAiUsage(
  purpose: AiUsagePurpose,
  tokensIn: number | null,
  tokensOut: number | null,
  costUsd: number | null,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("ai_usage_log")
    .insert({ purpose, tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: costUsd });
  if (error) console.error("[admin] logAiUsage failed:", error.message);
}

export async function getAiUsageCostThisMonth(): Promise<number> {
  const supabase = requireClient();
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ai_usage_log")
    .select("cost_usd")
    .gte("created_at", startOfMonth.toISOString());
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
}

// -----------------------------------------------------------------------------
// CRM: reports — reduce-in-JS over fetched rows, matching lib/admin/analytics.ts's
// existing style (no SQL group-by precedent anywhere in this codebase).
// -----------------------------------------------------------------------------

export async function getLeadFunnelStats(): Promise<Record<LeadStatus, number>> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("leads").select("status");
  if (error) throw error;

  const stats: Record<LeadStatus, number> = { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
  for (const row of data ?? []) {
    const status = (row.status ?? "new") as LeadStatus;
    stats[status] = (stats[status] ?? 0) + 1;
  }
  return stats;
}

export interface PipelineValueByStage {
  stageName: string;
  totalAmountCents: number;
  dealCount: number;
}

export async function getPipelineValueByStage(): Promise<PipelineValueByStage[]> {
  const supabase = requireClient();
  const [stagesResult, dealsResult] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name").order("sort_order", { ascending: true }),
    supabase.from("deals").select("pipeline_stage_id, amount_cents").eq("status", "open"),
  ]);
  if (stagesResult.error) throw stagesResult.error;
  if (dealsResult.error) throw dealsResult.error;

  return (stagesResult.data ?? []).map((stage) => {
    const dealsInStage = (dealsResult.data ?? []).filter((d) => d.pipeline_stage_id === stage.id);
    return {
      stageName: stage.name,
      totalAmountCents: dealsInStage.reduce((sum, d) => sum + (d.amount_cents ?? 0), 0),
      dealCount: dealsInStage.length,
    };
  });
}

export interface MonthlyRevenue {
  /** Jalaali year-month, e.g. "1405-06". */
  label: string;
  amountUsd: number;
}

/** Won deals bucketed by the Jalaali (Persian) calendar month they closed in. */
export async function getRevenueByMonthJalaali(months = 6): Promise<MonthlyRevenue[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("deals")
    .select("amount_cents, closed_at")
    .eq("status", "won")
    .not("closed_at", "is", null);
  if (error) throw error;

  const buckets = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.closed_at) continue;
    const date = new Date(row.closed_at);
    const jalaali = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    const key = `${jalaali.jy}-${String(jalaali.jm).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + (row.amount_cents ?? 0) / 100);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-months)
    .map(([label, amountUsd]) => ({ label, amountUsd }));
}

export async function getLeadSourceBreakdown(): Promise<Record<string, number>> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("leads").select("source");
  if (error) throw error;

  const stats: Record<string, number> = {};
  for (const row of data ?? []) {
    const source = row.source ?? "unknown";
    stats[source] = (stats[source] ?? 0) + 1;
  }
  return stats;
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
