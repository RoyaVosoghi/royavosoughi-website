import { NextResponse } from "next/server";
import { z } from "zod";

import { clientIp, jsonError, parseBody } from "@/lib/admin/api";
import { acceptContract, logContactNote } from "@/lib/admin/crm-docs";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

const BodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  agreed: z.literal(true),
});

/**
 * Acceptance, phase 1 of 2: stamp name + server time + IP. Returns exactly
 * what was stored, so the browser prints the database's timestamp — not its
 * own clock — into the signed PDF it builds for phase 2 (accepted-copy).
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseServiceConfigured()) return jsonError("not_configured", 503);

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { token } = await params;
  const contract = await acceptContract(token, body.data.name, clientIp(request));
  if (!contract) return jsonError("not_open", 409);

  await logContactNote(contract.contactId, contract.dealId, `Contract ${contract.contractNo} accepted online by ${contract.acceptedByName}`);

  return NextResponse.json({
    ok: true,
    acceptedAt: contract.acceptedAt,
    acceptedByName: contract.acceptedByName,
    acceptedIp: contract.acceptedIp,
  });
}
