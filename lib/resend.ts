import { Resend } from "resend";

import en from "@/messages/en.json";
import { site } from "@/lib/site";
import type { ContactSelect } from "@/lib/contact-options";
import type { ServiceKey } from "@/lib/service-options";

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
  company: string;
  message: string;
} & Partial<Record<ContactSelect, string>>;

/** Turns a stored option key ("from2to5k") into the English label the visitor saw. */
function optionLabel(field: ContactSelect, value: string | undefined): string {
  if (!value) return "—";
  const labels = en.contact[`${field}Options`] as Record<string, string>;
  return labels[value] ?? value;
}

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
    ["Role", optionLabel("role", data.role)],
    ["Company", data.company],
    ["Industry", optionLabel("industry", data.industry)],
    ["Company size", optionLabel("companySize", data.companySize)],
    ["Business stage", optionLabel("businessStage", data.businessStage)],
    ["Needs help with", optionLabel("needType", data.needType)],
    ["Handled today by", optionLabel("currentApproach", data.currentApproach)],
    ["Timeline", optionLabel("timeline", data.timeline)],
    ["Budget", optionLabel("budget", data.budget)],
    ["Preferred time", optionLabel("preferredTime", data.preferredTime)],
  ];

  const html = `
    <div style="font-family: sans-serif; max-width: 560px;">
      <h2 style="color: #1E1E1E;">New contact form submission</h2>
      <table cellpadding="6" style="border-collapse: collapse;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="color:#666;">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
          )
          .join("")}
      </table>
      <p style="color:#666; margin-top: 16px;">The problem</p>
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
      subject: `New inquiry from ${data.name} (${data.company})`,
      html,
    });
  } catch (error) {
    console.error("[resend] notification failed:", error);
  }
}

type ServiceRequestNotification = {
  service: ServiceKey;
  name: string;
  business: string;
  contact: string;
  email: string;
  message: string;
};

/** Best-effort, like sendContactNotification — the request is already saved. */
export async function sendServiceRequestNotification(data: ServiceRequestNotification) {
  const client = getClient();
  if (!client) return;

  const service = en.services.items[data.service].name;
  const rows = [
    ["Service", service],
    ["Name", data.name],
    ["Business", data.business],
    ["Phone / Telegram", data.contact],
    ["Email", data.email],
  ];

  const html = `
    <div style="font-family: sans-serif; max-width: 560px;">
      <h2 style="color: #1E1E1E;">New service request</h2>
      <table cellpadding="6" style="border-collapse: collapse;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="color:#666;">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
          )
          .join("")}
      </table>
      <p style="color:#666; margin-top: 16px;">Most important task to improve with AI</p>
      <p style="white-space: pre-wrap;">${escapeHtml(data.message)}</p>
    </div>
  `;

  try {
    await client.emails.send({
      from: FROM,
      to: NOTIFY_TO.toLowerCase(),
      replyTo: data.email,
      subject: `New ${service} request from ${data.name} (${data.business})`,
      html,
    });
  } catch (error) {
    console.error("[resend] service request notification failed:", error);
  }
}
