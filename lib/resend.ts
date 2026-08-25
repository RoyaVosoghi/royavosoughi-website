import { Resend } from "resend";

import { site } from "@/lib/site";

const apiKey = process.env.RESEND_API_KEY;

/**
 * Sandbox sender that works with any Resend account, no domain verification
 * needed. Swap RESEND_FROM_EMAIL to something @royavosoughi.com once that
 * domain is verified in the Resend dashboard.
 */
const FROM = process.env.RESEND_FROM_EMAIL || "Roya Vosoughi <onboarding@resend.dev>";
const NOTIFY_TO = process.env.CONTACT_NOTIFICATION_EMAIL || site.email;

export function isResendConfigured(): boolean {
  return Boolean(apiKey);
}

let cached: Resend | null = null;

function getClient(): Resend | null {
  if (!isResendConfigured()) return null;
  if (!cached) cached = new Resend(apiKey);
  return cached;
}

type ContactNotification = {
  name: string;
  email: string;
  company?: string | null;
  businessStage?: string | null;
  preferredTime?: string | null;
  message: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Best-effort — a bounced or failed notification email must never fail the
 * contact form submission, since the message is already saved in Supabase.
 */
export async function sendContactNotification(data: ContactNotification) {
  const client = getClient();
  if (!client) return;

  const rows = [
    ["Name", data.name],
    ["Email", data.email],
    ["Company", data.company || "—"],
    ["Business stage", data.businessStage || "—"],
    ["Preferred time", data.preferredTime || "—"],
  ];

  const html = `
    <div style="font-family: sans-serif; max-width: 560px;">
      <h2 style="color: #023316;">New contact form submission</h2>
      <table cellpadding="6" style="border-collapse: collapse;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="color:#666;">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
          )
          .join("")}
      </table>
      <p style="color:#666; margin-top: 16px;">Message</p>
      <p style="white-space: pre-wrap;">${escapeHtml(data.message)}</p>
    </div>
  `;

  try {
    await client.emails.send({
      from: FROM,
      // Resend's sandbox sender only allows the account's own address, matched
      // case-sensitively — lowercase avoids a false rejection from casing alone.
      to: NOTIFY_TO.toLowerCase(),
      replyTo: data.email,
      subject: `New inquiry from ${data.name}`,
      html,
    });
  } catch (error) {
    console.error("[resend] notification failed:", error);
  }
}
