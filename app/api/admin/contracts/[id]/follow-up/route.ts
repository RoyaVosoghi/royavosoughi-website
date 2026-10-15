import { NextResponse } from "next/server";

import { AI_ERROR, audit, gate, jsonError, requestOrigin } from "@/lib/admin/api";
import { getContract } from "@/lib/admin/crm-docs";
import { contractFollowUp } from "@/lib/ai/crm-writer";
import { daysSince } from "@/lib/crm/format";

export const maxDuration = 60;

/** Drafts a polite follow-up for a sent/viewed contract that hasn't been accepted — copied by the admin, never sent automatically. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return jsonError("not_found", 404);
  if (contract.status !== "sent" && contract.status !== "viewed") return jsonError("invalid_state", 409);

  const result = await contractFollowUp({
    locale: contract.locale,
    clientName: contract.clientName,
    title: contract.title,
    daysWaiting: daysSince(contract.sentAt),
    viewed: contract.status === "viewed",
    url: `${requestOrigin(request)}/contract/${contract.shareToken}`,
  });
  if (!result.ok) return jsonError(AI_ERROR[result.error].code, AI_ERROR[result.error].status);

  await audit("contract.ai_followup", contract.contractNo);
  return NextResponse.json({ ok: true, message: result.value });
}
