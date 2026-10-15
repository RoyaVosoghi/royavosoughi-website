import { NextResponse } from "next/server";
import { z } from "zod";

import { clientIp, jsonError, parseBody, requestOrigin } from "@/lib/admin/api";
import { getProposalByToken, logContactNote, respondToProposal } from "@/lib/admin/crm-docs";
import { sendProposalResponseEmails } from "@/lib/email/crm";
import { PROPOSAL_OPEN_FOR_RESPONSE } from "@/lib/crm/proposal";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

/**
 * Public, no login — the unguessable token in the URL is the credential.
 * Approve needs a name (and a package, when the proposal offers any);
 * "request changes" needs a note. The conditional UPDATE in
 * respondToProposal makes a double submit land exactly once.
 */
const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approved"), name: z.string().trim().min(2).max(200), optionId: z.string().max(40).nullable(), comment: z.string().trim().max(4000).optional() }),
  z.object({ action: z.literal("changes_requested"), name: z.string().trim().min(2).max(200), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("declined"), name: z.string().trim().min(2).max(200), comment: z.string().trim().max(4000).optional() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseServiceConfigured()) return jsonError("not_configured", 503);

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { token } = await params;
  const proposal = await getProposalByToken(token);
  if (!proposal) return jsonError("not_found", 404);
  if (!PROPOSAL_OPEN_FOR_RESPONSE.includes(proposal.status)) return jsonError("already_responded", 409);

  let optionId: string | null = null;
  if (body.data.action === "approved") {
    const requested = body.data.optionId;
    if (proposal.content.options.length) {
      optionId = proposal.content.options.find((o) => o.id === requested)?.id ?? null;
      if (!optionId) return jsonError("option_required", 400);
    }
  }

  const updated = await respondToProposal(token, {
    action: body.data.action,
    name: body.data.name,
    optionId,
    comment: body.data.comment ?? null,
    ip: clientIp(request),
  });
  if (!updated) return jsonError("already_responded", 409);

  const optionName = proposal.content.options.find((o) => o.id === optionId)?.name ?? null;
  const origin = requestOrigin(request);
  await logContactNote(
    updated.contactId,
    updated.dealId,
    `Proposal ${updated.proposalNo}: client ${body.data.action.replace("_", " ")}${optionName ? ` (${optionName})` : ""}`,
    body.data.comment || undefined,
  );
  await sendProposalResponseEmails(
    {
      locale: updated.locale,
      proposalNo: updated.proposalNo,
      title: updated.title,
      clientName: updated.clientName,
      clientEmail: updated.clientEmail,
      revision: updated.revision,
      url: `${origin}/proposal/${token}`,
      action: body.data.action,
      optionName,
      comment: body.data.comment ?? null,
      responderName: body.data.name,
      respondedAt: updated.respondedAt ?? new Date().toISOString(),
    },
    `${origin}/admin/proposals/${updated.id}`,
  );

  return NextResponse.json({ ok: true, status: updated.status });
}
