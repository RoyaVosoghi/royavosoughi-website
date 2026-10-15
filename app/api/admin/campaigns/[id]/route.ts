import { NextResponse } from "next/server";

import { audit, gate, jsonError } from "@/lib/admin/api";
import { deleteCampaign, getCampaign } from "@/lib/admin/crm-docs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("editor");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return jsonError("not_found", 404);
  try {
    await deleteCampaign(id);
    await audit("campaign.delete", campaign.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/campaigns] delete failed:", err);
    return jsonError("storage_failed", 500);
  }
}
