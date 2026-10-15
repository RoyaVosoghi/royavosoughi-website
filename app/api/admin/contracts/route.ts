import { NextResponse } from "next/server";

import { audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { createContract, logContactNote } from "@/lib/admin/crm-docs";
import { getContact } from "@/lib/admin/queries";
import { ContractInputSchema } from "@/lib/crm/contract";

export async function POST(request: Request) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, ContractInputSchema);
  if ("response" in body) return body.response;

  try {
    const contact = body.data.contactId ? await getContact(body.data.contactId) : null;
    const contract = await createContract({ ...body.data, companyId: contact?.companyId ?? null }, auth.admin.id);
    await logContactNote(contract.contactId, contract.dealId, `Contract ${contract.contractNo} drafted`);
    await audit("contract.create", contract.contractNo);
    return NextResponse.json({ ok: true, contract });
  } catch (err) {
    console.error("[admin/contracts] create failed:", err);
    return jsonError("storage_failed", 500);
  }
}
