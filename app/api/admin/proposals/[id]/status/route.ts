import { NextResponse } from "next/server";
import { z } from "zod";

import { audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { getProposal, setProposalStatus } from "@/lib/admin/crm-docs";

const BodySchema = z.object({ action: z.enum(["cancel", "reopen"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return jsonError("not_found", 404);
  if (proposal.status === "converted") return jsonError("locked", 409);
  if (body.data.action === "reopen" && proposal.status !== "canceled") return jsonError("invalid_transition", 409);

  try {
    await setProposalStatus(id, body.data.action === "cancel" ? "canceled" : "draft");
    await audit(body.data.action === "cancel" ? "proposal.cancel" : "proposal.reopen", proposal.proposalNo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/proposals] status failed:", err);
    return jsonError("storage_failed", 500);
  }
}
