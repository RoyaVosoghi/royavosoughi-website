import { NextResponse } from "next/server";
import { z } from "zod";

import { AI_ERROR, audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { getContract } from "@/lib/admin/crm-docs";
import { getContact, getDeal, getLead } from "@/lib/admin/queries";
import { rewriteContract } from "@/lib/ai/crm-writer";

export const maxDuration = 60;

const BodySchema = z.object({ bodyMd: z.string().min(1).max(60000) });

/** Returns a personalised body for the editor — nothing is saved until the admin reviews it and clicks Save. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return jsonError("not_found", 404);
  if (contract.status === "accepted" || contract.status === "canceled") return jsonError("locked", 409);

  const contact = contract.contactId ? await getContact(contract.contactId) : null;
  const [lead, deal] = await Promise.all([
    contact?.leadId ? getLead(contact.leadId) : null,
    contract.dealId ? getDeal(contract.dealId) : null,
  ]);

  const result = await rewriteContract({
    locale: contract.locale,
    bodyMd: body.data.bodyMd,
    clientName: contract.clientName,
    clientCompany: contract.clientCompany,
    leadChallenge: lead ? [lead.interest, lead.notes].filter(Boolean).join(" — ") || null : null,
    customerInsight: contact?.aiSummary ?? null,
    dealTitle: deal?.title ?? null,
  });
  if (!result.ok) return jsonError(AI_ERROR[result.error].code, AI_ERROR[result.error].status);

  await audit("contract.ai_rewrite", contract.contractNo);
  return NextResponse.json({ ok: true, bodyMd: result.value });
}
