import { NextResponse } from "next/server";

import { audit, gate, jsonError } from "@/lib/admin/api";
import {
  claimCampaignEmailForSend,
  getCampaignEmail,
  logContactNote,
  markCampaignSentIfDone,
  updateCampaignEmail,
} from "@/lib/admin/crm-docs";
import { isEmailConfigured, sendCampaignEmail } from "@/lib/email/crm";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; emailId: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;
  if (!isEmailConfigured()) return jsonError("email_not_configured", 503);

  const { id, emailId } = await params;
  const existing = await getCampaignEmail(emailId);
  if (!existing || existing.campaignId !== id) return jsonError("not_found", 404);
  if (!existing.subject || !existing.bodyText) return jsonError("not_ready", 409);

  // Claim first (ready → sent) so a double click or a second tab can't send twice.
  const email = await claimCampaignEmailForSend(emailId);
  if (!email) return jsonError("not_ready", 409);

  const result = await sendCampaignEmail({
    locale: email.locale,
    toEmail: email.toEmail,
    subject: email.subject!,
    bodyText: email.bodyText!,
  });
  if (!result.ok) {
    await updateCampaignEmail(emailId, { status: "failed", sentAt: null, error: "detail" in result ? (result.detail ?? result.error) : result.error });
    return jsonError("send_failed", 502);
  }

  await logContactNote(email.contactId, null, `Campaign email sent: ${email.subject}`, email.bodyText ?? undefined);
  await markCampaignSentIfDone(id);
  await audit("campaign.email_send", email.toEmail);
  return NextResponse.json({ ok: true });
}
