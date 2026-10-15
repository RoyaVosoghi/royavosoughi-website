import { NextResponse } from "next/server";

import { audit, gate, parseBody } from "@/lib/admin/api";
import { createProposal } from "@/lib/admin/crm-docs";
import { ProposalInputSchema } from "@/lib/crm/proposal";

export async function POST(request: Request) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, ProposalInputSchema);
  if ("response" in body) return body.response;

  try {
    const proposal = await createProposal(body.data, auth.admin.id);
    await audit("proposal.create", proposal.proposalNo);
    return NextResponse.json({ ok: true, proposal });
  } catch (err) {
    console.error("[admin/proposals] create failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
