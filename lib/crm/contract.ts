import { z } from "zod";

import { markdownToBlocks, type DocBlock } from "./doc-blocks";
import { docLabels } from "./doc-labels";
import { amountInWords, formatDate, formatDateTimeUtc, formatMoney, localizeDigits, type DocLocale } from "./format";
import type { ProposalPhase } from "./proposal";

export type ContractStatus = "draft" | "sent" | "viewed" | "accepted" | "canceled";

export const CONTRACT_STATUSES: ContractStatus[] = ["draft", "sent", "viewed", "accepted", "canceled"];

export const CONTRACT_OPEN_FOR_ACCEPTANCE: ContractStatus[] = ["sent", "viewed"];

export interface ContractTemplateInput {
  locale: DocLocale;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
  projectTitle: string;
  scopeSummary?: string;
  phases?: ProposalPhase[];
  deliverables?: string[];
  exclusions?: string[];
  amountCents: number;
  currency: string;
  paymentTerms?: string;
  durationLabel?: string;
  startDate?: string | null;
}

const bullets = (items: string[] | undefined, fallback: string) => {
  const clean = (items ?? []).map((s) => s.trim()).filter(Boolean);
  return clean.length ? clean.map((s) => `- ${s}`).join("\n") : fallback;
};

const phaseLines = (phases: ProposalPhase[] | undefined, locale: DocLocale, fallback: string) => {
  const clean = (phases ?? []).filter((p) => p.title.trim());
  if (!clean.length) return fallback;
  return clean
    .map((p, i) => {
      const duration = p.duration.trim() ? ` (${p.duration.trim()})` : "";
      return `${i + 1}. **${p.title.trim()}**${duration}: ${p.detail.trim()}`;
    })
    .join("\n");
};

/**
 * The 13-article contract, as Markdown. `## ` headings become numbered
 * articles when rendered, so articles can be added/removed in the editor
 * without renumbering by hand. Wording commits to effort and professional
 * care, never to business results. No governing-law country is filled in —
 * that is agreed per client.
 */
export function buildContractMarkdown(input: ContractTemplateInput): string {
  const { locale } = input;
  const amount = formatMoney(input.amountCents, input.currency, locale);
  const words = amountInWords(input.amountCents, input.currency, locale);
  const client = input.clientCompany ? `${input.clientName}, ${input.clientCompany}` : input.clientName;
  const start = input.startDate ? formatDate(input.startDate, locale) : null;

  if (locale === "fa") {
    return `## طرفین قرارداد
این قرارداد میان **Roya Vosoughi**، مهندس هوش مصنوعی و توسعه‌دهنده‌ی نرم‌افزار (از این پس «مشاور»)، و **${client}** با ایمیل ${input.clientEmail} (از این پس «کارفرما») منعقد می‌شود.

## موضوع قرارداد
موضوع این قرارداد «${input.projectTitle}» است. مشاور کار را در چهار قدم انجام می‌دهد: **شناخت** (تعریف مسئله و معیار موفقیت)، **طراحی** (معماری و نمونه‌ی اولیه)، **ساخت** (توسعه‌ی مرحله‌به‌مرحله با نسخه‌ی هفتگی) و **تحویل و پشتیبانی** (استقرار، آموزش و پشتیبانی).
${input.scopeSummary?.trim() ? `\n${input.scopeSummary.trim()}\n` : ""}
## شرح خدمات و مراحل اجرا
${phaseLines(input.phases, locale, "مراحل اجرا مطابق پروپوزال پیوست است.")}

## خروجی‌ها
${bullets(input.deliverables, "- خروجی‌ها مطابق پروپوزال پیوست است.")}

## مدت قرارداد
مدت اجرای این قرارداد ${input.durationLabel?.trim() || "مطابق زمان‌بندی پروپوزال"} است${start ? ` و از تاریخ ${start} آغاز می‌شود` : " و از تاریخ تأیید قرارداد آغاز می‌شود"}. تأخیر ناشی از فراهم‌نشدن به‌موقع دسترسی‌ها یا اطلاعات از سوی کارفرما به مدت قرارداد اضافه می‌شود.

## مبلغ قرارداد و شرایط پرداخت
مبلغ کل قرارداد **${amount}** (به حروف: ${words}) است.
شرایط پرداخت: ${input.paymentTerms?.trim() || "۵۰٪ هنگام تأیید قرارداد و ۵۰٪ هنگام تحویل نهایی"}.
هزینه‌های شخص ثالث (مانند مجوزهای نرم‌افزاری و هزینه‌ی استفاده از مدل‌های هوش مصنوعی) جداگانه و به قیمت تمام‌شده محاسبه می‌شود، مگر اینکه کتباً خلاف آن توافق شود.

## تعهدات مشاور
- انجام خدمات با دقت، مهارت و استانداردهای حرفه‌ای.
- ارسال گزارش کوتاه مکتوب پیشرفت کار به‌صورت هفتگی.
- اطلاع‌رسانی فوری درباره‌ی هر خطر یا تأخیر احتمالی.
- تعهد مشاور **تعهد به فعالیت است، نه تعهد به نتیجه**: مشاور متعهد به انجام کار شرح‌داده‌شده است، اما نتایج مشخص کسب‌وکاری (مانند افزایش فروش یا کاهش مشخص هزینه) را تضمین نمی‌کند، چون به عوامل متعددی خارج از کنترل مشاور بستگی دارد.

## تعهدات کارفرما
- معرفی یک نماینده‌ی تصمیم‌گیر برای پروژه.
- فراهم‌کردن به‌موقع دسترسی به داده‌ها، سیستم‌ها و افراد مرتبط (حداکثر ظرف دو روز کاری).
- بررسی و اعلام نظر درباره‌ی خروجی‌های هر مرحله در زمان توافق‌شده.
- پرداخت به‌موقع مبالغ طبق ماده‌ی مبلغ قرارداد.

## موارد خارج از دامنه
${bullets(input.exclusions, "- هر کاری که در شرح خدمات این قرارداد ذکر نشده باشد.")}
هر درخواست خارج از دامنه پیش از اجرا به‌صورت مکتوب برآورد و تأیید می‌شود.

## محرمانگی و مالکیت خروجی‌ها
- هر دو طرف اطلاعات محرمانه‌ی یکدیگر را محرمانه نگه می‌دارند؛ این تعهد پس از پایان قرارداد نیز باقی است.
- پس از تسویه‌ی کامل، مالکیت خروجی‌های اختصاصی این پروژه به کارفرما منتقل می‌شود.
- ابزارها، کتابخانه‌ها و دانش عمومی پیشین مشاور متعلق به مشاور باقی می‌ماند و مجوز استفاده از آن‌ها در خروجی‌ها به کارفرما داده می‌شود.
- مشاور می‌تواند بدون افشای اطلاعات محرمانه، به‌طور کلی به انجام این پروژه در سوابق کاری خود اشاره کند، مگر اینکه کارفرما کتباً مخالفت کند.

## فسخ قرارداد
هر یک از طرفین می‌تواند با اطلاع کتبی ۱۴ روزه قرارداد را فسخ کند. در صورت فسخ، کارفرما هزینه‌ی کار انجام‌شده تا تاریخ فسخ را می‌پردازد و مشاور خروجی‌های آماده‌شده تا آن تاریخ را تحویل می‌دهد.

## حل اختلاف
طرفین ابتدا می‌کوشند هر اختلافی را از راه گفت‌وگوی مستقیم و با حسن نیت حل کنند. اگر ظرف ۳۰ روز به نتیجه نرسید، موضوع به میانجی یا داوری که طرفین بر آن توافق می‌کنند ارجاع می‌شود. قانون حاکم: [با توافق طرفین تکمیل شود].

## نسخ قرارداد و تأیید آنلاین
این قرارداد در ۱۳ ماده تنظیم شده و به‌صورت الکترونیکی صادر می‌شود. تأیید آنلاین آن از سوی کارفرما — با ثبت نام، زمان و نشانی IP — به منزله‌ی امضای قرارداد است. نسخه‌ی تأییدشده برای هر دو طرف ایمیل می‌شود و هر نسخه اعتبار یکسان دارد.
`;
  }

  return `## Parties
This agreement is made between **Roya Vosoughi**, AI engineer and software developer (the "Consultant"), and **${client}**, email ${input.clientEmail} (the "Client").

## Subject of the agreement
The subject of this agreement is "${input.projectTitle}". The Consultant works in four steps: **Discover** (defining the problem and how success is measured), **Design** (architecture and prototype), **Build** (iterative development with a working version every week) and **Hand over & support** (deployment, training and support).
${input.scopeSummary?.trim() ? `\n${input.scopeSummary.trim()}\n` : ""}
## Scope of services and phases
${phaseLines(input.phases, locale, "Phases as described in the attached proposal.")}

## Deliverables
${bullets(input.deliverables, "- Deliverables as described in the attached proposal.")}

## Term
The work runs for ${input.durationLabel?.trim() || "the period set out in the proposal timeline"}${start ? `, starting on ${start}` : ", starting on the date this agreement is accepted"}. Delays caused by late access to data, systems or people on the Client's side extend the term accordingly.

## Fee and payment terms
The total fee is **${amount}** (in words: ${words}).
Payment terms: ${input.paymentTerms?.trim() || "50% on acceptance of this agreement and 50% on final handover"}.
Third-party costs (such as software licences and AI-model usage fees) are charged separately at cost, unless agreed otherwise in writing.

## Consultant's obligations
- Perform the services with professional care, skill and diligence.
- Send a short written progress update every week.
- Raise any risk or likely delay as soon as it becomes known.
- The Consultant's commitment is an **obligation of effort, not of result**: the Consultant commits to carrying out the work described, but does not guarantee specific business outcomes (such as a given increase in revenue or reduction in cost), which depend on many factors outside the Consultant's control.

## Client's obligations
- Appoint one decision-maker for the project.
- Provide timely access to data, systems and people (within two working days of a request).
- Review and give feedback on each phase's output within the agreed time.
- Pay invoices on time as set out under Fee and payment terms.

## Out of scope
${bullets(input.exclusions, "- Any work not described under Scope of services.")}
Any out-of-scope request is estimated and approved in writing before work begins.

## Confidentiality and ownership of deliverables
- Each party keeps the other's confidential information confidential; this obligation survives the end of the agreement.
- On full payment, ownership of the deliverables created specifically for this project passes to the Client.
- The Consultant's pre-existing tools, libraries and general know-how remain the Consultant's, with a licence granted to the Client to use them as part of the deliverables.
- The Consultant may mention the project in general terms in their portfolio, without disclosing confidential information, unless the Client objects in writing.

## Termination
Either party may terminate this agreement with 14 days' written notice. On termination, the Client pays for the work performed up to the termination date and the Consultant hands over the deliverables completed up to that date.

## Dispute resolution
The parties will first try to resolve any dispute through direct, good-faith discussion. If it is not resolved within 30 days, it will be referred to a mediator or arbitrator agreed by both parties. Governing law: [to be agreed by the parties].

## Counterparts and online acceptance
This agreement consists of 13 articles and is issued electronically. The Client's online acceptance — recorded with their name, the time and their IP address — constitutes signature of this agreement. The accepted copy is emailed to both parties, and each copy is equally valid.
`;
}

export interface ContractDocInput {
  locale: DocLocale;
  title: string;
  contractNo: string;
  clientName: string;
  clientCompany: string | null;
  bodyMd: string;
  issuedAt: string;
  acceptedByName: string | null;
  acceptedAt: string | null;
  acceptedIp: string | null;
}

export function contractToBlocks(input: ContractDocInput): DocBlock[] {
  const { locale } = input;
  const L = docLabels(locale);
  const client = input.clientCompany ? `${input.clientName} · ${input.clientCompany}` : input.clientName;

  const blocks: DocBlock[] = [
    { type: "title", text: input.title || "—", subtitle: L.preparedFor(client) },
    {
      type: "facts",
      items: [
        { label: L.contractNo, value: input.contractNo },
        { label: L.date, value: formatDate(input.issuedAt, locale) },
      ],
    },
    ...markdownToBlocks(input.bodyMd, locale),
  ];

  const accepted = Boolean(input.acceptedAt && input.acceptedByName);
  blocks.push({
    type: "signature",
    parties: [
      {
        role: L.signature.consultant,
        name: L.brandName,
        lines: [L.signature.issued, formatDate(input.issuedAt, locale)],
        signed: true,
      },
      {
        role: L.signature.client,
        name: accepted ? input.acceptedByName! : input.clientName,
        lines: accepted
          ? [
              L.signature.acceptedBy(input.acceptedByName!),
              L.signature.acceptedAt(formatDateTimeUtc(input.acceptedAt, locale)),
              ...(input.acceptedIp ? [L.signature.fromIp(input.acceptedIp)] : []),
            ]
          : [L.signature.awaiting],
        signed: accepted,
      },
    ],
  });

  return blocks;
}

/** "RV-P-2026-007" (proposal) / "RV-C-2026-007" (contract). Always Latin digits — it's an identifier, quoted in emails and searched for. */
export function formatDocNo(kind: "P" | "C", year: number, seq: number): string {
  return `RV-${kind}-${year}-${String(seq).padStart(3, "0")}`;
}

/** Body of create/update requests from the contract editor. companyId is derived from the contact server-side. */
export const ContractInputSchema = z.object({
  locale: z.enum(["en", "fa"]),
  title: z.string().trim().min(1).max(300),
  contactId: z.string().uuid().nullable(),
  dealId: z.string().uuid().nullable(),
  clientName: z.string().trim().min(1).max(200),
  clientEmail: z.string().trim().email().max(320),
  clientCompany: z.string().trim().max(200).nullable(),
  bodyMd: z.string().max(60000),
  amountCents: z.number().int().min(0).max(1e13),
  currency: z.string().trim().length(3),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  durationLabel: z.string().trim().max(120).nullable(),
});

export type ContractInputBody = z.infer<typeof ContractInputSchema>;
