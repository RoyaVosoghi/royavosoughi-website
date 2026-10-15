import { NextResponse } from "next/server";
import { z } from "zod";

import { audit, gate, jsonError, parseBody, requestOrigin } from "@/lib/admin/api";
import { addProposalComment, getProposal } from "@/lib/admin/crm-docs";
import { isEmailConfigured, sendProposalReplyEmail } from "@/lib/email/crm";

const BodySchema = z.object({ body: z.string().trim().min(1).max(4000) });

/** Admin reply in the proposal's thread — stored, then emailed to the client when email is configured. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return jsonError("not_found", 404);

  try {
    await addProposalComment(id, { author: "admin", body: body.data.body, revision: proposal.revision, adminId: auth.admin.id });
  } catch (err) {
    console.error("[admin/proposals] comment failed:", err);
    return jsonError("storage_failed", 500);
  }

  let emailed = false;
  if (isEmailConfigured()) {
    const result = await sendProposalReplyEmail(
      {
        locale: proposal.locale,
        proposalNo: proposal.proposalNo,
        title: proposal.title,
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        revision: proposal.revision,
        url: `${requestOrigin(request)}/proposal/${proposal.viewToken}`,
      },
      body.data.body,
    );
    emailed = result.ok;
  }

  await audit("proposal.reply", proposal.proposalNo);
  return NextResponse.json({ ok: true, emailed });
}
