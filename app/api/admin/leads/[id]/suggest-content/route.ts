import { NextResponse } from "next/server";

import { AI_ERROR, gate, jsonError, requestOrigin } from "@/lib/admin/api";
import { logContactNote } from "@/lib/admin/crm-docs";
import { getLead, writeAuditLog } from "@/lib/admin/queries";
import { suggestContentForLead } from "@/lib/ai/content-suggest";
import { listPublishedPosts } from "@/lib/blog";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

/**
 * "Suggest content" on a lead: the most relevant published post + a short
 * follow-up message to copy. Prefers posts in the lead's language; if the
 * lead has already been converted, the suggestion is also logged on the
 * contact's timeline.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return jsonError("not_found", 404);

  const all = await listPublishedPosts();
  const sameLanguage = all.filter((p) => p.locale === lead.locale);
  const posts = (sameLanguage.length ? sameLanguage : all).slice(0, 40);
  if (!posts.length) return jsonError("no_posts", 409);

  const result = await suggestContentForLead(lead, posts);
  if (!result.ok) return jsonError(AI_ERROR[result.error].code, AI_ERROR[result.error].status);

  const url = `${requestOrigin(request)}/${result.post.locale}/blog/${result.post.slug}`;

  let logged = false;
  const supabase = getSupabaseAdminClient();
  const { data: contact } = supabase ? await supabase.from("contacts").select("id").eq("lead_id", lead.id).maybeSingle() : { data: null };
  if (contact) {
    await logContactNote(contact.id, null, `Content suggested: ${result.post.title}`, `${result.message}\n\n${url}`);
    logged = true;
  }

  await writeAuditLog("lead.content_suggestion", `${lead.email} → ${result.post.locale}/${result.post.slug}`);
  return NextResponse.json({ ok: true, post: { title: result.post.title, url }, message: result.message, logged });
}
