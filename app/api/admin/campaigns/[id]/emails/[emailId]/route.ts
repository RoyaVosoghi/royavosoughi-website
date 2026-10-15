import { NextResponse } from "next/server";
import { z } from "zod";

import { audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { getCampaignEmail, updateCampaignEmail } from "@/lib/admin/crm-docs";

const BodySchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  bodyText: z.string().trim().min(1).max(4000).optional(),
  /** Skip / un-skip. Approving an edited draft keeps it "ready". */
  status: z.enum(["ready", "skipped", "pending"]).optional(),
});

/** Human-in-the-loop edits: change subject/body, or skip a recipient. Sent emails are immutable. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; emailId: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  const { id, emailId } = await params;
  const email = await getCampaignEmail(emailId);
  if (!email || email.campaignId !== id) return jsonError("not_found", 404);
  if (email.status === "sent") return jsonError("locked", 409);

  let status = body.data.status;
  // Un-skipping goes back to "ready" if there's a draft to send, else "pending".
  if (status === "ready" && !(body.data.subject ?? email.subject)) status = "pending";

  try {
    await updateCampaignEmail(emailId, { subject: body.data.subject, bodyText: body.data.bodyText, status });
    await audit("campaign.email_update", email.toEmail);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/campaigns] email update failed:", err);
    return jsonError("storage_failed", 500);
  }
}
