import { NextResponse } from "next/server";
import { z } from "zod";

import { audit, decodePdf, gate, jsonError, parseBody, requestOrigin } from "@/lib/admin/api";
import { advanceDealToProposalStage, getProposal, logContactNote, markProposalSent } from "@/lib/admin/crm-docs";
import { isEmailConfigured, sendProposalEmail } from "@/lib/email/crm";

export const maxDuration = 60;

const BodySchema = z.union([
  z.object({ manual: z.literal(false).optional(), pdfBase64: z.string().min(100).max(4_400_000) }),
  z.object({ manual: z.literal(true) }),
]);

/**
 * Last step of the browser-side send orchestrator (save → re-layout with the
 * real number → PDF → here). Email first, then mark sent: a failed email
 * leaves the proposal exactly as it was. `manual` marks it sent without
 * email, for sharing the link by hand.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return jsonError("not_found", 404);
  if (proposal.status === "converted" || proposal.status === "canceled") return jsonError("locked", 409);

  const url = `${requestOrigin(request)}/proposal/${proposal.viewToken}`;

  if (!body.data.manual) {
    if (!isEmailConfigured()) return jsonError("email_not_configured", 503);
    const pdf = decodePdf(body.data.pdfBase64);
    if (!pdf) return jsonError("invalid_pdf", 400);

    const result = await sendProposalEmail(
      {
        locale: proposal.locale,
        proposalNo: proposal.proposalNo,
        title: proposal.title,
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        revision: proposal.revision + 1,
        url,
      },
      body.data.pdfBase64,
    );
    if (!result.ok) return jsonError(result.error, 502, { detail: "detail" in result ? result.detail : undefined });
  }

  try {
    const sent = await markProposalSent(id);
    const movedDeal = proposal.dealId ? await advanceDealToProposalStage(proposal.dealId) : false;
    await logContactNote(
      proposal.contactId,
      proposal.dealId,
      `Proposal ${proposal.proposalNo} sent (revision ${sent.revision})${body.data.manual ? " — link shared manually" : ""}`,
    );
    await audit("proposal.send", `${proposal.proposalNo} r${sent.revision}`);
    return NextResponse.json({ ok: true, proposal: sent, url, movedDeal });
  } catch (err) {
    console.error("[admin/proposals] mark sent failed:", err);
    return jsonError("storage_failed", 500);
  }
}
