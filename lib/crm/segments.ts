import "server-only";

import type { CampaignRecipient } from "@/lib/admin/crm-docs";
import { isDocLocale } from "@/lib/crm/format";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Segment builder — each segment is a small, readable query function rather
 * than a generic rules engine, so adding one means adding one entry here.
 * Every segment returns at most MAX_RECIPIENTS people who have an email,
 * deduplicated by email, each with a `context` object the AI uses to write
 * a genuinely individual email (their challenge, their deal, their history).
 */

export const SEGMENT_KEYS = ["stale_leads", "lost_leads", "lost_deals", "won_customers"] as const;
export type SegmentKey = (typeof SEGMENT_KEYS)[number];

export function isSegmentKey(value: unknown): value is SegmentKey {
  return typeof value === "string" && (SEGMENT_KEYS as readonly string[]).includes(value);
}

export const MAX_RECIPIENTS = 20;
const STALE_DAYS = 7;

function requireClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

type ContactJoin = { id: string; name: string; email: string; locale: string; ai_summary: string | null } | null;
const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

async function leadSegment(statuses: string[], olderThanDays: number | null): Promise<CampaignRecipient[]> {
  const supabase = requireClient();
  let query = supabase
    .from("leads")
    .select("id, name, email, interest, source, locale, status, notes, ai_score_reason, created_at")
    .in("status", statuses)
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_RECIPIENTS * 3);
  if (olderThanDays !== null) {
    query = query.lt("created_at", new Date(Date.now() - olderThanDays * 86_400_000).toISOString());
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((lead) => ({
    contactId: null,
    leadId: lead.id,
    toName: lead.name,
    toEmail: lead.email,
    locale: isDocLocale(lead.locale) ? lead.locale : "en",
    context: {
      kind: "lead",
      status: lead.status,
      challenge: lead.interest,
      source: lead.source,
      notes: lead.notes,
      aiAssessment: lead.ai_score_reason,
      firstContact: lead.created_at,
    },
  }));
}

async function dealSegment(status: "won" | "lost"): Promise<CampaignRecipient[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("deals")
    .select("id, title, amount_cents, currency, closed_at, contacts(id, name, email, locale, ai_summary), companies(name)")
    .eq("status", status)
    .order("closed_at", { ascending: false })
    .limit(MAX_RECIPIENTS * 3);
  if (error) throw error;
  return (data ?? []).flatMap((deal) => {
    const contact = one(deal.contacts as ContactJoin | ContactJoin[]);
    const company = one(deal.companies as { name: string } | { name: string }[] | null);
    if (!contact?.email) return [];
    return [
      {
        contactId: contact.id,
        leadId: null,
        toName: contact.name,
        toEmail: contact.email,
        locale: isDocLocale(contact.locale) ? contact.locale : "en",
        context: {
          kind: status === "won" ? "customer" : "lost_deal",
          dealTitle: deal.title,
          company: company?.name ?? null,
          closedAt: deal.closed_at,
          customerInsight: contact.ai_summary,
        },
      },
    ];
  });
}

export async function buildSegment(key: SegmentKey): Promise<CampaignRecipient[]> {
  let recipients: CampaignRecipient[];
  switch (key) {
    case "stale_leads":
      recipients = await leadSegment(["new", "contacted"], STALE_DAYS);
      break;
    case "lost_leads":
      recipients = await leadSegment(["lost"], null);
      break;
    case "lost_deals":
      recipients = await dealSegment("lost");
      break;
    case "won_customers":
      recipients = await dealSegment("won");
      break;
  }

  const seen = new Set<string>();
  return recipients
    .filter((r) => {
      const email = r.toEmail.trim().toLowerCase();
      if (!email.includes("@") || seen.has(email)) return false;
      seen.add(email);
      return true;
    })
    .slice(0, MAX_RECIPIENTS);
}

/** Plain-English description handed to the AI so it knows who it is writing to (admin UI labels live in the i18n tree). */
export const SEGMENT_AI_DESCRIPTIONS: Record<SegmentKey, string> = {
  stale_leads: "People who reached out more than a week ago and have not had a follow-up yet.",
  lost_leads: "Leads that went cold or were marked lost.",
  lost_deals: "Prospects who received an offer but did not go ahead.",
  won_customers: "Existing clients who already worked with Roya.",
};
