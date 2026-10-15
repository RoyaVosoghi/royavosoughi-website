import "server-only";

import { randomBytes } from "node:crypto";

import {
  createActivity,
  createContact,
  escapeLike,
  findOrCreateCompanyByName,
  getContact,
  type Contact,
} from "@/lib/admin/queries";
import { formatDocNo, type ContractStatus } from "@/lib/crm/contract";
import type { DocLocale } from "@/lib/crm/format";
import { ProposalContentSchema, emptyProposalContent, type ProposalContent, type ProposalStatus } from "@/lib/crm/proposal";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Data access for the V5 CRM documents (proposals, contracts) and campaigns.
 * Kept out of lib/admin/queries.ts, which is already the home of everything
 * V1–V4; same conventions: service-role client, camelCase domain objects,
 * throw on DB error, conditional updates for anything a client can race on.
 */

function requireClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

const UNIQUE_VIOLATION = "23505";

/**
 * Next "RV-P-2026-007"-style number: one more than the LARGEST sequence used
 * this year — not the row count, so deleting a document can never make the
 * next one reuse a number. Callers retry on a unique violation for the
 * (rare) case of two documents created in the same instant.
 */
async function nextDocNo(table: "proposals" | "contracts", column: "proposal_no" | "contract_no", kind: "P" | "C"): Promise<string> {
  const supabase = requireClient();
  const year = new Date().getUTCFullYear();
  const prefix = `RV-${kind}-${year}-`;
  const { data, error } = await supabase.from(table).select(column).like(column, `${prefix}%`);
  if (error) throw error;
  const max = (data ?? []).reduce((acc, row) => {
    const seq = Number(String((row as Record<string, string>)[column]).slice(prefix.length));
    return Number.isFinite(seq) && seq > acc ? seq : acc;
  }, 0);
  return formatDocNo(kind, year, max + 1);
}

async function insertWithDocNo<T>(insert: (docNo: string) => Promise<{ data: T | null; error: { code?: string } | null }>, next: () => Promise<string>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await insert(await next());
    if (!error && data) return data;
    if (error?.code !== UNIQUE_VIOLATION) throw error;
  }
  throw new Error("doc_no_conflict");
}

// -----------------------------------------------------------------------------
// Proposals
// -----------------------------------------------------------------------------

export interface Proposal {
  id: string;
  proposalNo: string;
  locale: DocLocale;
  contactId: string | null;
  dealId: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  clientPhone: string | null;
  title: string;
  content: ProposalContent;
  currency: string;
  validUntil: string | null;
  status: ProposalStatus;
  viewToken: string;
  revision: number;
  sentAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  respondedAt: string | null;
  selectedOption: string | null;
  responderName: string | null;
  responderIp: string | null;
  contractId: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROPOSAL_COLUMNS =
  "id, proposal_no, locale, contact_id, deal_id, client_name, client_email, client_company, client_phone, title, content, currency, valid_until, status, view_token, revision, sent_at, first_viewed_at, last_viewed_at, view_count, responded_at, selected_option, responder_name, responder_ip, contract_id, created_at, updated_at";

type ProposalRow = Record<string, unknown> & { content: unknown };

function toProposal(row: ProposalRow): Proposal {
  const parsed = ProposalContentSchema.safeParse(row.content);
  return {
    id: row.id as string,
    proposalNo: row.proposal_no as string,
    locale: (row.locale as DocLocale) ?? "en",
    contactId: (row.contact_id as string) ?? null,
    dealId: (row.deal_id as string) ?? null,
    clientName: row.client_name as string,
    clientEmail: row.client_email as string,
    clientCompany: (row.client_company as string) ?? null,
    clientPhone: (row.client_phone as string) ?? null,
    title: row.title as string,
    content: parsed.success ? parsed.data : { ...emptyProposalContent(), ...(row.content as object) },
    currency: row.currency as string,
    validUntil: (row.valid_until as string) ?? null,
    status: row.status as ProposalStatus,
    viewToken: row.view_token as string,
    revision: row.revision as number,
    sentAt: (row.sent_at as string) ?? null,
    firstViewedAt: (row.first_viewed_at as string) ?? null,
    lastViewedAt: (row.last_viewed_at as string) ?? null,
    viewCount: (row.view_count as number) ?? 0,
    respondedAt: (row.responded_at as string) ?? null,
    selectedOption: (row.selected_option as string) ?? null,
    responderName: (row.responder_name as string) ?? null,
    responderIp: (row.responder_ip as string) ?? null,
    contractId: (row.contract_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface ProposalInput {
  locale: DocLocale;
  contactId: string | null;
  dealId: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  clientPhone: string | null;
  title: string;
  content: ProposalContent;
  currency: string;
  validUntil: string | null;
}

function proposalInputToRow(input: ProposalInput) {
  return {
    locale: input.locale,
    contact_id: input.contactId,
    deal_id: input.dealId,
    client_name: input.clientName,
    client_email: input.clientEmail,
    client_company: input.clientCompany,
    client_phone: input.clientPhone,
    title: input.title,
    content: input.content,
    currency: input.currency,
    valid_until: input.validUntil,
  };
}

export async function getProposals(filter: { needsAction?: boolean; contactId?: string } = {}, limit = 200): Promise<Proposal[]> {
  const supabase = requireClient();
  let query = supabase.from("proposals").select(PROPOSAL_COLUMNS);
  if (filter.needsAction) query = query.in("status", ["approved", "changes_requested"]);
  if (filter.contactId) query = query.eq("contact_id", filter.contactId);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toProposal(row as ProposalRow));
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("proposals").select(PROPOSAL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toProposal(data as ProposalRow) : null;
}

export async function getProposalByToken(token: string): Promise<Proposal | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("proposals").select(PROPOSAL_COLUMNS).eq("view_token", token).maybeSingle();
  if (error) throw error;
  return data ? toProposal(data as ProposalRow) : null;
}

export async function createProposal(input: ProposalInput, adminId: string | null): Promise<Proposal> {
  const supabase = requireClient();
  const row = await insertWithDocNo(
    async (docNo) =>
      supabase
        .from("proposals")
        .insert({ ...proposalInputToRow(input), proposal_no: docNo, view_token: newShareToken(), created_by: adminId })
        .select(PROPOSAL_COLUMNS)
        .single(),
    () => nextDocNo("proposals", "proposal_no", "P"),
  );
  return toProposal(row as unknown as ProposalRow);
}

/** Editing is allowed in every status except converted/canceled — a sent proposal edited and re-sent becomes the next revision. */
export async function updateProposal(id: string, input: ProposalInput): Promise<Proposal | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("proposals")
    .update({ ...proposalInputToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .not("status", "in", "(converted,canceled)")
    .select(PROPOSAL_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toProposal(data as ProposalRow) : null;
}

export async function deleteProposal(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("proposals").delete().eq("id", id);
  if (error) throw error;
}

export async function setProposalStatus(id: string, status: ProposalStatus): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("proposals").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** First send → revision 1; any later send → next revision, and the previous client response is cleared so they can respond to the new version. */
export async function markProposalSent(id: string): Promise<Proposal> {
  const supabase = requireClient();
  const current = await getProposal(id);
  if (!current) throw new Error("not_found");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: "sent",
      revision: current.revision + 1,
      sent_at: now,
      responded_at: null,
      responder_name: null,
      responder_ip: null,
      selected_option: null,
      updated_at: now,
    })
    .eq("id", id)
    .select(PROPOSAL_COLUMNS)
    .single();
  if (error) throw error;
  return toProposal(data as ProposalRow);
}

/** Public page view: counts every view, and the first one after sending flips sent → viewed. */
export async function recordProposalView(proposal: Proposal): Promise<void> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    view_count: proposal.viewCount + 1,
    last_viewed_at: now,
  };
  if (!proposal.firstViewedAt) patch.first_viewed_at = now;
  await supabase.from("proposals").update(patch).eq("id", proposal.id);
  if (proposal.status === "sent") {
    await supabase.from("proposals").update({ status: "viewed" }).eq("id", proposal.id).eq("status", "sent");
  }
}

export type ProposalResponse = "approved" | "changes_requested" | "declined";

/**
 * The status filter in the UPDATE itself is the double-click guard: two
 * concurrent submissions both pass any earlier read check, but only one
 * can match `status in (sent, viewed)` — the other gets zero rows back.
 */
export async function respondToProposal(
  token: string,
  response: { action: ProposalResponse; name: string; optionId: string | null; comment: string | null; ip: string | null },
): Promise<Proposal | null> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: response.action,
      responded_at: now,
      responder_name: response.name,
      responder_ip: response.ip,
      selected_option: response.optionId,
      updated_at: now,
    })
    .eq("view_token", token)
    .in("status", ["sent", "viewed"])
    .select(PROPOSAL_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const proposal = toProposal(data as ProposalRow);
  if (response.comment?.trim()) {
    await addProposalComment(proposal.id, { author: "client", body: response.comment.trim(), revision: proposal.revision, adminId: null });
  }
  return proposal;
}

export interface ProposalComment {
  id: string;
  author: "client" | "admin";
  body: string;
  revision: number;
  createdAt: string;
}

export async function getProposalComments(proposalId: string): Promise<ProposalComment[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("proposal_comments")
    .select("id, author, body, revision, created_at")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    author: row.author as "client" | "admin",
    body: row.body,
    revision: row.revision,
    createdAt: row.created_at,
  }));
}

export async function addProposalComment(
  proposalId: string,
  comment: { author: "client" | "admin"; body: string; revision: number; adminId: string | null },
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("proposal_comments").insert({
    proposal_id: proposalId,
    author: comment.author,
    body: comment.body,
    revision: comment.revision,
    created_by: comment.adminId,
  });
  if (error) throw error;
}

export async function linkProposalToContract(proposalId: string, contractId: string, contactId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("proposals")
    .update({ status: "converted", contract_id: contractId, contact_id: contactId, updated_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Contracts
// -----------------------------------------------------------------------------

export interface Contract {
  id: string;
  contractNo: string;
  locale: DocLocale;
  title: string;
  contactId: string | null;
  dealId: string | null;
  companyId: string | null;
  proposalId: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  bodyMd: string;
  amountCents: number;
  currency: string;
  startDate: string | null;
  durationLabel: string | null;
  status: ContractStatus;
  shareToken: string;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  acceptedIp: string | null;
  acceptedCopySentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONTRACT_COLUMNS =
  "id, contract_no, locale, title, contact_id, deal_id, company_id, proposal_id, client_name, client_email, client_company, body_md, amount_cents, currency, start_date, duration_label, status, share_token, sent_at, viewed_at, accepted_at, accepted_by_name, accepted_ip, accepted_copy_sent_at, created_at, updated_at";

function toContract(row: Record<string, unknown>): Contract {
  return {
    id: row.id as string,
    contractNo: row.contract_no as string,
    locale: (row.locale as DocLocale) ?? "en",
    title: row.title as string,
    contactId: (row.contact_id as string) ?? null,
    dealId: (row.deal_id as string) ?? null,
    companyId: (row.company_id as string) ?? null,
    proposalId: (row.proposal_id as string) ?? null,
    clientName: row.client_name as string,
    clientEmail: row.client_email as string,
    clientCompany: (row.client_company as string) ?? null,
    bodyMd: (row.body_md as string) ?? "",
    amountCents: Number(row.amount_cents ?? 0),
    currency: row.currency as string,
    startDate: (row.start_date as string) ?? null,
    durationLabel: (row.duration_label as string) ?? null,
    status: row.status as ContractStatus,
    shareToken: row.share_token as string,
    sentAt: (row.sent_at as string) ?? null,
    viewedAt: (row.viewed_at as string) ?? null,
    acceptedAt: (row.accepted_at as string) ?? null,
    acceptedByName: (row.accepted_by_name as string) ?? null,
    acceptedIp: (row.accepted_ip as string) ?? null,
    acceptedCopySentAt: (row.accepted_copy_sent_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface ContractInput {
  locale: DocLocale;
  title: string;
  contactId: string | null;
  dealId: string | null;
  companyId: string | null;
  proposalId?: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  bodyMd: string;
  amountCents: number;
  currency: string;
  startDate: string | null;
  durationLabel: string | null;
}

function contractInputToRow(input: ContractInput) {
  return {
    locale: input.locale,
    title: input.title,
    contact_id: input.contactId,
    deal_id: input.dealId,
    company_id: input.companyId,
    ...(input.proposalId !== undefined ? { proposal_id: input.proposalId } : {}),
    client_name: input.clientName,
    client_email: input.clientEmail,
    client_company: input.clientCompany,
    body_md: input.bodyMd,
    amount_cents: input.amountCents,
    currency: input.currency,
    start_date: input.startDate,
    duration_label: input.durationLabel,
  };
}

export async function getContracts(filter: { contactId?: string; status?: ContractStatus } = {}, limit = 200): Promise<Contract[]> {
  const supabase = requireClient();
  let query = supabase.from("contracts").select(CONTRACT_COLUMNS);
  if (filter.contactId) query = query.eq("contact_id", filter.contactId);
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(toContract);
}

export async function getContract(id: string): Promise<Contract | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("contracts").select(CONTRACT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toContract(data) : null;
}

export async function getContractByToken(token: string): Promise<Contract | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("contracts").select(CONTRACT_COLUMNS).eq("share_token", token).maybeSingle();
  if (error) throw error;
  return data ? toContract(data) : null;
}

export async function createContract(input: ContractInput, adminId: string | null): Promise<Contract> {
  const supabase = requireClient();
  const row = await insertWithDocNo(
    async (docNo) =>
      supabase
        .from("contracts")
        .insert({ ...contractInputToRow(input), contract_no: docNo, share_token: newShareToken(), created_by: adminId })
        .select(CONTRACT_COLUMNS)
        .single(),
    () => nextDocNo("contracts", "contract_no", "C"),
  );
  return toContract(row as unknown as Record<string, unknown>);
}

/** Accepted and canceled contracts are locked — returns null if the row is in one of those states. */
export async function updateContract(id: string, input: ContractInput): Promise<Contract | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ ...contractInputToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "sent", "viewed"])
    .select(CONTRACT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toContract(data) : null;
}

export async function deleteContract(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("contracts").delete().eq("id", id).neq("status", "accepted");
  if (error) throw error;
}

export async function setContractStatus(id: string, status: ContractStatus): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("contracts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "accepted");
  if (error) throw error;
}

export async function markContractSent(id: string): Promise<Contract | null> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "sent", sent_at: now, updated_at: now })
    .eq("id", id)
    .in("status", ["draft", "sent", "viewed"])
    .select(CONTRACT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toContract(data) : null;
}

export async function recordContractView(contract: Contract): Promise<void> {
  if (contract.status !== "sent") return;
  const supabase = requireClient();
  await supabase
    .from("contracts")
    .update({ status: "viewed", viewed_at: new Date().toISOString() })
    .eq("id", contract.id)
    .eq("status", "sent");
}

/** Phase 1 of acceptance — stamps name, server time and IP. The status filter makes a double submit a no-op (null). */
export async function acceptContract(token: string, name: string, ip: string | null): Promise<Contract | null> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "accepted", accepted_at: now, accepted_by_name: name, accepted_ip: ip, updated_at: now })
    .eq("share_token", token)
    .in("status", ["sent", "viewed"])
    .select(CONTRACT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toContract(data) : null;
}

/** Phase 2 guard — only the first caller gets the row back, so the signed copy is emailed exactly once. */
export async function claimAcceptedCopy(token: string): Promise<Contract | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ accepted_copy_sent_at: new Date().toISOString() })
    .eq("share_token", token)
    .eq("status", "accepted")
    .is("accepted_copy_sent_at", null)
    .select(CONTRACT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toContract(data) : null;
}

/** Undo the claim if the email itself failed, so the client can retry. */
export async function releaseAcceptedCopy(id: string): Promise<void> {
  const supabase = requireClient();
  await supabase.from("contracts").update({ accepted_copy_sent_at: null }).eq("id", id);
}

// -----------------------------------------------------------------------------
// Shared CRM side effects
// -----------------------------------------------------------------------------

/** Proposal conversion for a manually-entered client: reuse the contact with this email, or create one (plus company). */
export async function findOrCreateContactForClient(client: {
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  locale: DocLocale;
}): Promise<Contact> {
  const supabase = requireClient();
  const { data: existing, error } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", escapeLike(client.email.trim()))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    const contact = await getContact(existing.id);
    if (contact) return contact;
  }
  const company = client.company?.trim() ? await findOrCreateCompanyByName(client.company) : null;
  return createContact({
    name: client.name,
    email: client.email.trim(),
    phone: client.phone,
    companyId: company?.id ?? null,
    source: "proposal",
    locale: client.locale,
  });
}

/**
 * Sending a proposal moves its deal forward to the first stage whose name
 * mentions "proposal" — but only forward, and only for open deals. Stages
 * are admin-editable, so this matches by name rather than a hardcoded id.
 */
export async function advanceDealToProposalStage(dealId: string): Promise<boolean> {
  const supabase = requireClient();
  const [{ data: deal }, { data: stages }] = await Promise.all([
    supabase.from("deals").select("id, status, pipeline_stage_id").eq("id", dealId).maybeSingle(),
    supabase.from("pipeline_stages").select("id, name, sort_order, is_won, is_lost").order("sort_order"),
  ]);
  if (!deal || deal.status !== "open" || !stages) return false;
  const target = stages.find((s) => /proposal|پروپوزال/i.test(s.name) && !s.is_won && !s.is_lost);
  const current = stages.find((s) => s.id === deal.pipeline_stage_id);
  if (!target || !current || current.sort_order >= target.sort_order) return false;
  const { error } = await supabase
    .from("deals")
    .update({ pipeline_stage_id: target.id, updated_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) throw error;
  return true;
}

/** Best-effort timeline note on the contact — a failed note must never fail the action that triggered it. */
export async function logContactNote(contactId: string | null, dealId: string | null, subject: string, body?: string): Promise<void> {
  if (!contactId) return;
  try {
    await createActivity({ contactId, dealId, type: "note", subject, body: body ?? null });
  } catch (err) {
    console.error("[crm-docs] timeline note failed:", err);
  }
}

// -----------------------------------------------------------------------------
// Campaigns
// -----------------------------------------------------------------------------

export type CampaignEmailStatus = "pending" | "ready" | "skipped" | "sent" | "failed";

export interface Campaign {
  id: string;
  name: string;
  segmentKey: string;
  goal: string;
  status: "draft" | "sent";
  sentAt: string | null;
  createdAt: string;
  counts: Record<CampaignEmailStatus, number>;
}

export interface CampaignEmail {
  id: string;
  campaignId: string;
  contactId: string | null;
  leadId: string | null;
  toName: string;
  toEmail: string;
  locale: DocLocale;
  context: Record<string, unknown>;
  subject: string | null;
  bodyText: string | null;
  status: CampaignEmailStatus;
  error: string | null;
  sentAt: string | null;
}

const CAMPAIGN_EMAIL_COLUMNS =
  "id, campaign_id, contact_id, lead_id, to_name, to_email, locale, context, subject, body_text, status, error, sent_at";

function toCampaignEmail(row: Record<string, unknown>): CampaignEmail {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    contactId: (row.contact_id as string) ?? null,
    leadId: (row.lead_id as string) ?? null,
    toName: row.to_name as string,
    toEmail: row.to_email as string,
    locale: (row.locale as DocLocale) ?? "en",
    context: (row.context as Record<string, unknown>) ?? {},
    subject: (row.subject as string) ?? null,
    bodyText: (row.body_text as string) ?? null,
    status: row.status as CampaignEmailStatus,
    error: (row.error as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
  };
}

const emptyCounts = (): Record<CampaignEmailStatus, number> => ({ pending: 0, ready: 0, skipped: 0, sent: 0, failed: 0 });

const CAMPAIGN_COLUMNS = "id, name, segment_key, goal, status, sent_at, created_at, campaign_emails(status)";

function toCampaign(row: Record<string, unknown>): Campaign {
  const counts = emptyCounts();
  for (const e of (row.campaign_emails as Array<{ status: CampaignEmailStatus }>) ?? []) counts[e.status] += 1;
  return {
    id: row.id as string,
    name: row.name as string,
    segmentKey: row.segment_key as string,
    goal: row.goal as string,
    status: row.status as "draft" | "sent",
    sentAt: (row.sent_at as string) ?? null,
    createdAt: row.created_at as string,
    counts,
  };
}

export async function getCampaigns(limit = 100): Promise<Campaign[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toCampaign);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCampaign(data) : null;
}

export async function getCampaignEmails(campaignId: string): Promise<CampaignEmail[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("campaign_emails")
    .select(CAMPAIGN_EMAIL_COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toCampaignEmail);
}

export async function getCampaignEmail(id: string): Promise<CampaignEmail | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("campaign_emails").select(CAMPAIGN_EMAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCampaignEmail(data) : null;
}

export interface CampaignRecipient {
  contactId: string | null;
  leadId: string | null;
  toName: string;
  toEmail: string;
  locale: DocLocale;
  context: Record<string, unknown>;
}

export async function createCampaign(
  input: { name: string; segmentKey: string; goal: string; recipients: CampaignRecipient[] },
  adminId: string | null,
): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ name: input.name, segment_key: input.segmentKey, goal: input.goal, created_by: adminId })
    .select("id")
    .single();
  if (error) throw error;
  if (input.recipients.length) {
    const { error: emailsError } = await supabase.from("campaign_emails").insert(
      input.recipients.map((r) => ({
        campaign_id: data.id,
        contact_id: r.contactId,
        lead_id: r.leadId,
        to_name: r.toName,
        to_email: r.toEmail,
        locale: r.locale,
        context: r.context,
      })),
    );
    if (emailsError) throw emailsError;
  }
  return data.id;
}

export async function updateCampaignEmail(
  id: string,
  patch: { subject?: string | null; bodyText?: string | null; status?: CampaignEmailStatus; error?: string | null; sentAt?: string | null },
): Promise<void> {
  const supabase = requireClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.subject !== undefined) dbPatch.subject = patch.subject;
  if (patch.bodyText !== undefined) dbPatch.body_text = patch.bodyText;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.error !== undefined) dbPatch.error = patch.error;
  if (patch.sentAt !== undefined) dbPatch.sent_at = patch.sentAt;
  const { error } = await supabase.from("campaign_emails").update(dbPatch).eq("id", id);
  if (error) throw error;
}

/** Claims one email for sending (ready → sent) before the API call, so two tabs can't both send it. */
export async function claimCampaignEmailForSend(id: string): Promise<CampaignEmail | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("campaign_emails")
    .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
    .eq("id", id)
    .in("status", ["ready", "failed"])
    .select(CAMPAIGN_EMAIL_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toCampaignEmail(data) : null;
}

export async function markCampaignSentIfDone(campaignId: string): Promise<void> {
  const supabase = requireClient();
  const { count } = await supabase
    .from("campaign_emails")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "ready"]);
  if ((count ?? 0) === 0) {
    await supabase.from("campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaignId).eq("status", "draft");
  }
}

export async function deleteCampaign(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

/** PostgREST/Postgres "relation does not exist" — the V5 SQL block hasn't been run yet. Pages show setup instructions instead of crashing. */
export function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? "");
}
