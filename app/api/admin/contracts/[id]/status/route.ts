import { NextResponse } from "next/server";
import { z } from "zod";

import { audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { getContract, setContractStatus } from "@/lib/admin/crm-docs";

const BodySchema = z.object({ action: z.enum(["cancel", "reopen"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return jsonError("not_found", 404);
  if (contract.status === "accepted") return jsonError("locked", 409);
  if (body.data.action === "reopen" && contract.status !== "canceled") return jsonError("invalid_transition", 409);

  try {
    await setContractStatus(id, body.data.action === "cancel" ? "canceled" : "draft");
    await audit(body.data.action === "cancel" ? "contract.cancel" : "contract.reopen", contract.contractNo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/contracts] status failed:", err);
    return jsonError("storage_failed", 500);
  }
}
