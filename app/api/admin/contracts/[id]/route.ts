import { NextResponse } from "next/server";

import { audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { deleteContract, getContract, updateContract } from "@/lib/admin/crm-docs";
import { getContact } from "@/lib/admin/queries";
import { ContractInputSchema } from "@/lib/crm/contract";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, ContractInputSchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  try {
    const contact = body.data.contactId ? await getContact(body.data.contactId) : null;
    const contract = await updateContract(id, { ...body.data, companyId: contact?.companyId ?? null });
    if (!contract) return jsonError("locked", 409);
    await audit("contract.update", contract.contractNo);
    return NextResponse.json({ ok: true, contract });
  } catch (err) {
    console.error("[admin/contracts] update failed:", err);
    return jsonError("storage_failed", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("editor");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return jsonError("not_found", 404);
  if (contract.status === "accepted") return jsonError("locked", 409);
  try {
    await deleteContract(id);
    await audit("contract.delete", contract.contractNo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/contracts] delete failed:", err);
    return jsonError("storage_failed", 500);
  }
}
