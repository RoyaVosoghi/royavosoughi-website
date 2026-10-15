import { NextResponse } from "next/server";
import { z } from "zod";

import { audit, decodePdf, gate, jsonError, parseBody, requestOrigin } from "@/lib/admin/api";
import { getContract, logContactNote, markContractSent } from "@/lib/admin/crm-docs";
import { isEmailConfigured, sendContractEmail } from "@/lib/email/crm";

export const maxDuration = 60;

const BodySchema = z.union([
  z.object({ manual: z.literal(false).optional(), pdfBase64: z.string().min(100).max(4_400_000) }),
  z.object({ manual: z.literal(true) }),
]);

/** Email the contract (PDF attached + acceptance link), or — `manual` — just mark it sent so the link can be shared by hand. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return jsonError("not_found", 404);
  if (contract.status === "accepted" || contract.status === "canceled") return jsonError("locked", 409);
  if (!contract.bodyMd.trim()) return jsonError("empty_body", 400);

  const url = `${requestOrigin(request)}/contract/${contract.shareToken}`;

  if (!body.data.manual) {
    if (!isEmailConfigured()) return jsonError("email_not_configured", 503);
    if (!decodePdf(body.data.pdfBase64)) return jsonError("invalid_pdf", 400);
    const result = await sendContractEmail(
      {
        locale: contract.locale,
        contractNo: contract.contractNo,
        title: contract.title,
        clientName: contract.clientName,
        clientEmail: contract.clientEmail,
        url,
      },
      body.data.pdfBase64,
    );
    if (!result.ok) return jsonError(result.error, 502, { detail: "detail" in result ? result.detail : undefined });
  }

  try {
    const sent = await markContractSent(id);
    if (!sent) return jsonError("locked", 409);
    await logContactNote(
      contract.contactId,
      contract.dealId,
      `Contract ${contract.contractNo} sent${body.data.manual ? " — link shared manually" : " by email"}`,
    );
    await audit(body.data.manual ? "contract.share_link" : "contract.send", contract.contractNo);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[admin/contracts] mark sent failed:", err);
    return jsonError("storage_failed", 500);
  }
}
