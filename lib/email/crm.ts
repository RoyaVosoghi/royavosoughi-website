import "server-only";

import { Resend } from "resend";

import { formatDateTimeUtc, type DocLocale } from "@/lib/crm/format";
import { brandColors, site } from "@/lib/site";

/**
 * Client-facing CRM email: proposals, response receipts, thread replies,
 * contracts, signed copies, campaign emails. Same Resend account and sender
 * env vars as lib/resend.ts (the contact-form notification). Every function
 * returns {ok, error} instead of throwing — a missing key or a bounce must
 * not break the action around it; the caller decides what to tell the admin.
 *
 * NOTE: the default sandbox sender (onboarding@resend.dev) can only deliver
 * to the Resend account owner's own address. To email real clients, verify
 * royavosoughi.com in Resend and set RESEND_FROM_EMAIL.
 */

const FROM = process.env.RESEND_FROM_EMAIL || "Roya Vosoughi <onboarding@resend.dev>";
const TEAM_TO = process.env.CRM_NOTIFY_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL || site.email;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let cached: Resend | null = null;
function getClient(): Resend | null {
  if (!isEmailConfigured()) return null;
  if (!cached) cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

export type EmailResult = { ok: true } | { ok: false; error: "not_configured" | "send_failed"; detail?: string };

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface EmailContent {
  locale: DocLocale;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Small print under the button. */
  note?: string;
}

/** Brand shell: ink header with the wordmark, cobalt rule, cream body; RTL for Farsi; system fonts only (web fonts are unreliable in mail clients). */
export function renderEmail(content: EmailContent): string {
  const rtl = content.locale === "fa";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = rtl ? "Tahoma, 'Segoe UI', Arial, sans-serif" : "'Segoe UI', Helvetica, Arial, sans-serif";
  const paragraphs = content.paragraphs
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:${rtl ? 2 : 1.6};color:${brandColors.ink};text-align:${align}">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const cta = content.cta
    ? `<p style="margin:22px 0 8px;text-align:${align}"><a href="${escapeHtml(content.cta.url)}" style="display:inline-block;background:${brandColors.cobalt};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 26px;border-radius:999px">${escapeHtml(content.cta.label)}</a></p>`
    : "";
  const note = content.note
    ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#6b655e;text-align:${align}">${escapeHtml(content.note)}</p>`
    : "";

  return `<!doctype html>
<html lang="${content.locale}" dir="${dir}">
<body style="margin:0;padding:0;background:${brandColors.canvas}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brandColors.canvas}">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${font}" dir="${dir}">
<tr><td style="background:${brandColors.ink};padding:20px 28px;border-radius:16px 16px 0 0;text-align:${align}">
<span dir="ltr" style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:-0.5px">Roya Vosoughi</span>
</td></tr>
<tr><td style="height:4px;background:${brandColors.cobalt};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:28px;border-radius:0 0 16px 16px">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.4;color:${brandColors.ink};text-align:${align}">${escapeHtml(content.heading)}</h1>
${paragraphs}${cta}${note}
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#6b655e;text-align:${align}">
<span dir="ltr">${escapeHtml(site.domain)}</span> · ${escapeHtml(rtl ? "هوش مصنوعی، مهندسی‌شده برای واقعیت" : site.slogan)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderText(content: EmailContent): string {
  return [content.heading, "", ...content.paragraphs, content.cta ? `\n${content.cta.label}: ${content.cta.url}` : "", content.note ?? ""]
    .filter((line) => line !== undefined)
    .join("\n\n")
    .trim();
}

async function send(input: {
  to: string;
  subject: string;
  content: EmailContent;
  attachment?: { filename: string; base64: string };
  replyTo?: string;
}): Promise<EmailResult> {
  const client = getClient();
  if (!client) return { ok: false, error: "not_configured" };
  try {
    const { error } = await client.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: renderEmail(input.content),
      text: renderText(input.content),
      replyTo: input.replyTo ?? site.email,
      attachments: input.attachment ? [{ filename: input.attachment.filename, content: input.attachment.base64 }] : undefined,
    });
    if (error) {
      console.error("[email/crm] send failed:", error);
      return { ok: false, error: "send_failed", detail: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email/crm] send threw:", err);
    return { ok: false, error: "send_failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

// -----------------------------------------------------------------------------
// Proposals
// -----------------------------------------------------------------------------

interface ProposalMailInfo {
  locale: DocLocale;
  proposalNo: string;
  title: string;
  clientName: string;
  clientEmail: string;
  revision: number;
  url: string;
}

export function sendProposalEmail(p: ProposalMailInfo, pdfBase64: string): Promise<EmailResult> {
  const fa = p.locale === "fa";
  const revised = p.revision > 1;
  return send({
    to: p.clientEmail,
    subject: fa
      ? `${revised ? "نسخه‌ی به‌روزشده‌ی " : ""}پروپوزال ${p.title} — ${p.proposalNo}`
      : `${revised ? "Updated proposal" : "Proposal"}: ${p.title} — ${p.proposalNo}`,
    attachment: { filename: `${p.proposalNo}.pdf`, base64: pdfBase64 },
    content: {
      locale: p.locale,
      heading: fa ? `${firstName(p.clientName)} عزیز، پروپوزال شما آماده است` : `${firstName(p.clientName)}, your proposal is ready`,
      paragraphs: fa
        ? [
            revised
              ? "نسخه‌ی به‌روزشده‌ی پروپوزال، با اعمال نکاتی که گفته بودید، پیوست این ایمیل است."
              : "از گفت‌وگوی‌مان ممنونم. پروپوزال کامل پیوست این ایمیل است.",
            "در لینک زیر می‌توانید آن را آنلاین ببینید، بسته‌ی مناسب را انتخاب کنید و تأیید کنید — یا اگر چیزی باید تغییر کند، همان‌جا برایم بنویسید.",
          ]
        : [
            revised
              ? "Attached is the updated proposal, with the changes you asked for."
              : "Thank you for the conversation. The full proposal is attached.",
            "Use the link below to read it online, choose the package that fits, and approve it — or tell me there what should change.",
          ],
      cta: { label: fa ? "مشاهده و پاسخ به پروپوزال" : "View and respond", url: p.url },
      note: fa ? "Roya Vosoughi — هر سؤالی داشتید، به همین ایمیل پاسخ دهید." : "Roya Vosoughi — any question, just reply to this email.",
    },
  });
}

export async function sendProposalResponseEmails(
  p: ProposalMailInfo & { action: "approved" | "changes_requested" | "declined"; optionName: string | null; comment: string | null; responderName: string; respondedAt: string },
  adminUrl: string,
): Promise<EmailResult> {
  const fa = p.locale === "fa";
  const receiptBody: Record<typeof p.action, { en: string; fa: string }> = {
    approved: {
      en: `Thank you — I've received your approval${p.optionName ? ` of the ${p.optionName} package` : ""}. I'll send the contract for online signature shortly.`,
      fa: `ممنونم — تأیید شما${p.optionName ? ` برای بسته‌ی «${p.optionName}»` : ""} به دستم رسید. به‌زودی قرارداد را برای تأیید آنلاین می‌فرستم.`,
    },
    changes_requested: {
      en: "Thank you for the feedback — I've received your notes and will come back with an updated proposal.",
      fa: "ممنون از نظرتان — توضیحات شما به دستم رسید و با نسخه‌ی به‌روزشده‌ی پروپوزال برمی‌گردم.",
    },
    declined: {
      en: "Thank you for letting me know. If anything changes, I'm happy to pick the conversation up again.",
      fa: "ممنون که خبر دادید. اگر شرایط تغییر کرد، با کمال میل گفت‌وگو را ادامه می‌دهیم.",
    },
  };

  const receipt = await send({
    to: p.clientEmail,
    subject: fa ? `پاسخ شما ثبت شد — ${p.proposalNo}` : `Your response is recorded — ${p.proposalNo}`,
    content: {
      locale: p.locale,
      heading: fa ? `${firstName(p.clientName)} عزیز، پاسخ شما ثبت شد` : `Thanks, ${firstName(p.clientName)}`,
      paragraphs: [receiptBody[p.action][fa ? "fa" : "en"], ...(p.comment ? [fa ? `یادداشت شما: ${p.comment}` : `Your note: ${p.comment}`] : [])],
      cta: { label: fa ? "مشاهده‌ی پروپوزال" : "View proposal", url: p.url },
    },
  });

  const actionLabel = { approved: "APPROVED", changes_requested: "CHANGES REQUESTED", declined: "DECLINED" }[p.action];
  await send({
    to: TEAM_TO,
    subject: `[CRM] ${p.proposalNo} ${actionLabel} by ${p.responderName}`,
    content: {
      locale: "en",
      heading: `${p.proposalNo} — ${actionLabel.toLowerCase()}`,
      paragraphs: [
        `${p.responderName} (${p.clientEmail}) responded to "${p.title}" (revision ${p.revision}) at ${formatDateTimeUtc(p.respondedAt, "en")}.`,
        p.optionName ? `Selected package: ${p.optionName}` : "",
        p.comment ? `Note: ${p.comment}` : "",
      ],
      cta: { label: "Open in admin", url: adminUrl },
    },
  });

  return receipt;
}

export function sendProposalReplyEmail(p: ProposalMailInfo, body: string): Promise<EmailResult> {
  const fa = p.locale === "fa";
  return send({
    to: p.clientEmail,
    subject: fa ? `درباره‌ی پروپوزال ${p.proposalNo}` : `Re: proposal ${p.proposalNo}`,
    content: {
      locale: p.locale,
      heading: fa ? `${firstName(p.clientName)} عزیز،` : `Hi ${firstName(p.clientName)},`,
      paragraphs: [body],
      cta: { label: fa ? "مشاهده‌ی پروپوزال" : "View proposal", url: p.url },
    },
  });
}

// -----------------------------------------------------------------------------
// Contracts
// -----------------------------------------------------------------------------

interface ContractMailInfo {
  locale: DocLocale;
  contractNo: string;
  title: string;
  clientName: string;
  clientEmail: string;
  url: string;
}

export function sendContractEmail(c: ContractMailInfo, pdfBase64: string): Promise<EmailResult> {
  const fa = c.locale === "fa";
  return send({
    to: c.clientEmail,
    subject: fa ? `قرارداد ${c.title} — ${c.contractNo}` : `Contract: ${c.title} — ${c.contractNo}`,
    attachment: { filename: `${c.contractNo}.pdf`, base64: pdfBase64 },
    content: {
      locale: c.locale,
      heading: fa ? `${firstName(c.clientName)} عزیز، قرارداد آماده‌ی تأیید است` : `${firstName(c.clientName)}, your contract is ready to sign`,
      paragraphs: fa
        ? ["قرارداد پیوست این ایمیل است. لطفاً آن را بخوانید و از طریق لینک زیر به‌صورت آنلاین تأیید کنید.", "بعد از تأیید، نسخه‌ی تأییدشده برای هر دو طرف ایمیل می‌شود."]
        : ["The contract is attached. Please read it and accept it online using the link below.", "Once accepted, the signed copy is emailed to both of us."],
      cta: { label: fa ? "مطالعه و تأیید قرارداد" : "Read and accept", url: c.url },
      note: fa ? "سؤالی دارید؟ به همین ایمیل پاسخ دهید." : "Questions? Just reply to this email.",
    },
  });
}

export async function sendAcceptedContractEmails(
  c: ContractMailInfo & { acceptedByName: string; acceptedAt: string },
  pdfBase64: string,
  adminUrl: string,
): Promise<EmailResult> {
  const fa = c.locale === "fa";
  const attachment = { filename: `${c.contractNo}-signed.pdf`, base64: pdfBase64 };
  const client = await send({
    to: c.clientEmail,
    subject: fa ? `نسخه‌ی تأییدشده‌ی قرارداد — ${c.contractNo}` : `Your signed contract — ${c.contractNo}`,
    attachment,
    content: {
      locale: c.locale,
      heading: fa ? "قرارداد تأیید شد" : "Contract accepted",
      paragraphs: fa
        ? [
            `${firstName(c.clientName)} عزیز، قرارداد «${c.title}» در ${formatDateTimeUtc(c.acceptedAt, "fa")} توسط ${c.acceptedByName} تأیید شد. نسخه‌ی تأییدشده پیوست است.`,
            "به‌زودی برای تنظیم جلسه‌ی شروع با شما تماس می‌گیرم.",
          ]
        : [
            `${firstName(c.clientName)}, "${c.title}" was accepted by ${c.acceptedByName} on ${formatDateTimeUtc(c.acceptedAt, "en")}. The signed copy is attached.`,
            "I'll be in touch shortly to schedule our kick-off call.",
          ],
      cta: { label: fa ? "مشاهده‌ی قرارداد" : "View contract", url: c.url },
    },
  });
  await send({
    to: TEAM_TO,
    subject: `[CRM] ${c.contractNo} ACCEPTED by ${c.acceptedByName}`,
    attachment,
    content: {
      locale: "en",
      heading: `${c.contractNo} accepted`,
      paragraphs: [`${c.acceptedByName} (${c.clientEmail}) accepted "${c.title}" at ${formatDateTimeUtc(c.acceptedAt, "en")}.`],
      cta: { label: "Open in admin", url: adminUrl },
    },
  });
  return client;
}

// -----------------------------------------------------------------------------
// Campaigns
// -----------------------------------------------------------------------------

export function sendCampaignEmail(e: { locale: DocLocale; toEmail: string; subject: string; bodyText: string }): Promise<EmailResult> {
  const fa = e.locale === "fa";
  return send({
    to: e.toEmail,
    subject: e.subject,
    content: {
      locale: e.locale,
      heading: e.subject,
      paragraphs: e.bodyText.split(/\n\s*\n/),
      cta: { label: fa ? "رزرو مشاوره‌ی رایگان ۳۰ دقیقه‌ای" : "Book a free 30-minute consultation", url: `${site.url}/${e.locale}#contact` },
      note: fa
        ? "اگر نمی‌خواهید ایمیل دیگری از من دریافت کنید، فقط به همین ایمیل پاسخ دهید و بنویسید «لغو»."
        : "If you'd rather not hear from me again, just reply with \"unsubscribe\".",
    },
  });
}
