import { NextResponse } from "next/server";

import { audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { deleteProposal, getProposal, updateProposal } from "@/lib/admin/crm-docs";
import { ProposalInputSchema } from "@/lib/crm/proposal";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, ProposalInputSchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  try {
    const proposal = await updateProposal(id, body.data);
    if (!proposal) return jsonError("locked", 409);
    await audit("proposal.update", proposal.proposalNo);
    return NextResponse.json({ ok: true, proposal });
  } catch (err) {
    console.error("[admin/proposals] update failed:", err);
    return jsonError("storage_failed", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("editor");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return jsonError("not_found", 404);
  try {
    await deleteProposal(id);
    await audit("proposal.delete", proposal.proposalNo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/proposals] delete failed:", err);
    return jsonError("storage_failed", 500);
  }
}
