import { NextResponse } from "next/server";

import { AI_ERROR, audit, gate, jsonError } from "@/lib/admin/api";
import { getCampaign, getCampaignEmail, updateCampaignEmail } from "@/lib/admin/crm-docs";
import { writeCampaignEmail } from "@/lib/ai/crm-writer";
import { SEGMENT_AI_DESCRIPTIONS, isSegmentKey } from "@/lib/crm/segments";

export const maxDuration = 60;

/** One recipient per request — the "Generate all" button loops client-side, so no single request can hit the function timeout. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; emailId: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const { id, emailId } = await params;
  const [campaign, email] = await Promise.all([getCampaign(id), getCampaignEmail(emailId)]);
  if (!campaign || !email || email.campaignId !== id) return jsonError("not_found", 404);
  if (email.status === "sent") return jsonError("locked", 409);

  const result = await writeCampaignEmail({
    locale: email.locale,
    goal: campaign.goal,
    segmentLabel: isSegmentKey(campaign.segmentKey) ? SEGMENT_AI_DESCRIPTIONS[campaign.segmentKey] : campaign.segmentKey,
    toName: email.toName,
    context: email.context,
  });
  if (!result.ok) {
    return jsonError(AI_ERROR[result.error].code, AI_ERROR[result.error].status);
  }

  try {
    await updateCampaignEmail(emailId, { subject: result.value.subject, bodyText: result.value.body, status: "ready", error: null });
    await audit("campaign.email_generate", email.toEmail);
    return NextResponse.json({ ok: true, subject: result.value.subject, bodyText: result.value.body });
  } catch (err) {
    console.error("[admin/campaigns] save draft failed:", err);
    return jsonError("storage_failed", 500);
  }
}
