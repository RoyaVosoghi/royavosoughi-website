import { NextResponse } from "next/server";
import { z } from "zod";

import { decodePdf, jsonError, parseBody, requestOrigin } from "@/lib/admin/api";
import { claimAcceptedCopy, getContractByToken, releaseAcceptedCopy } from "@/lib/admin/crm-docs";
import { isEmailConfigured, sendAcceptedContractEmails } from "@/lib/email/crm";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const maxDuration = 60;

const BodySchema = z.object({ pdfBase64: z.string().min(100).max(4_400_000) });

/**
 * Acceptance, phase 2 of 2: the browser has rendered the signed copy with
 * the stored name/time/IP; this emails it to the client and to Roya — once.
 * claimAcceptedCopy is a conditional UPDATE, so a refresh or a second tab
 * can't send it twice; if the email fails, the claim is released for a retry.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseServiceConfigured()) return jsonError("not_configured", 503);

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;
  if (!decodePdf(body.data.pdfBase64)) return jsonError("invalid_pdf", 400);

  const { token } = await params;
  const current = await getContractByToken(token);
  if (!current || current.status !== "accepted") return jsonError("not_accepted", 409);
  if (current.acceptedCopySentAt) return NextResponse.json({ ok: true, alreadySent: true });
  if (!isEmailConfigured()) return NextResponse.json({ ok: true, emailed: false });

  const contract = await claimAcceptedCopy(token);
  if (!contract) return NextResponse.json({ ok: true, alreadySent: true });

  const origin = requestOrigin(request);
  const result = await sendAcceptedContractEmails(
    {
      locale: contract.locale,
      contractNo: contract.contractNo,
      title: contract.title,
      clientName: contract.clientName,
      clientEmail: contract.clientEmail,
      url: `${origin}/contract/${token}`,
      acceptedByName: contract.acceptedByName ?? contract.clientName,
      acceptedAt: contract.acceptedAt ?? new Date().toISOString(),
    },
    body.data.pdfBase64,
    `${origin}/admin/contracts/${contract.id}`,
  );
  if (!result.ok) {
    await releaseAcceptedCopy(contract.id);
    return jsonError("email_failed", 502);
  }
  return NextResponse.json({ ok: true, emailed: true });
}
