import { z } from "zod";

import type { DocBlock } from "./doc-blocks";
import { docLabels } from "./doc-labels";
import { formatDate, formatMoney, localizeDigits, type DocLocale } from "./format";

// -----------------------------------------------------------------------------
// Shape of proposals.content — validated on every save (API) and used as-is
// by the editor and the A4 renderer.
// -----------------------------------------------------------------------------

export const ProposalPhaseSchema = z.object({
  title: z.string().max(200),
  detail: z.string().max(2000),
  duration: z.string().max(100),
});

export const ProposalOptionSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().max(120),
  tagline: z.string().max(300),
  priceCents: z.number().int().min(0).max(1e13),
  recommended: z.boolean(),
  features: z.array(z.string().max(500)).max(30),
  paymentNote: z.string().max(500),
  durationNote: z.string().max(200),
});

const lines = z.array(z.string().max(1000)).max(40);

export const ProposalContentSchema = z.object({
  intro: z.string().max(5000),
  understanding: lines,
  goals: lines,
  phases: z.array(ProposalPhaseSchema).max(15),
  deliverables: lines,
  methodology: z.string().max(5000),
  timelineNote: z.string().max(2000),
  options: z.array(ProposalOptionSchema).max(4),
  exclusions: lines,
  assumptions: lines,
  whyMe: lines,
  nextSteps: lines,
  termsNote: z.string().max(5000),
});

export type ProposalPhase = z.infer<typeof ProposalPhaseSchema>;
export type ProposalOption = z.infer<typeof ProposalOptionSchema>;
export type ProposalContent = z.infer<typeof ProposalContentSchema>;

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "changes_requested"
  | "declined"
  | "converted"
  | "canceled";

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  "draft", "sent", "viewed", "approved", "changes_requested", "declined", "converted", "canceled",
];

/** Statuses in which the client can still respond on the public page. */
export const PROPOSAL_OPEN_FOR_RESPONSE: ProposalStatus[] = ["sent", "viewed"];

export function emptyProposalContent(): ProposalContent {
  return {
    intro: "",
    understanding: [],
    goals: [],
    phases: [],
    deliverables: [],
    methodology: "",
    timelineNote: "",
    options: [],
    exclusions: [],
    assumptions: [],
    whyMe: [],
    nextSteps: [],
    termsNote: "",
  };
}

// -----------------------------------------------------------------------------
// Templates. Voice per the brand guide: direct, practical, warm, "you"/«شما»,
// no hype words, and never a promise of business results — only of the work.
// -----------------------------------------------------------------------------

export type ProposalTemplateKey = "custom_ai_build" | "blank";

export const PROPOSAL_TEMPLATE_KEYS: ProposalTemplateKey[] = ["custom_ai_build", "blank"];

const CUSTOM_AI_BUILD: Record<DocLocale, { title: string; content: ProposalContent }> = {
  en: {
    title: "Custom AI assistant for your business",
    content: {
      intro:
        "Thank you for the conversation. This proposal sets out how I would build an AI tool that fits the way your team already works — what it does, how we get there, what you receive, and what it costs.\n\nThe aim is a working system your team uses every day, not a demo. You will see progress every week, and I stay available after handover.",
      understanding: [
        "Your team spends hours each week on a repetitive task that depends on information scattered across documents, emails and tools.",
        "Answers are inconsistent because they depend on who is available and what they remember.",
        "You want to use AI, but only where it measurably saves time — and without your data leaving your control.",
      ],
      goals: [
        "Cut the time spent on the selected workflow, measured against today's baseline.",
        "Give your team consistent answers grounded in your own documents, with sources shown.",
        "Leave you with a system your team can run, understand and extend.",
      ],
      phases: [
        {
          title: "Discover",
          detail: "Workshops with the people who do the work today; we pick the one workflow worth automating first and agree how we will measure success.",
          duration: "1 week",
        },
        {
          title: "Design",
          detail: "Architecture, data sources, privacy and access rules, and a clickable prototype you can react to before anything is built.",
          duration: "1 week",
        },
        {
          title: "Build",
          detail: "Iterative development with a working version every week, tested on your real documents and questions.",
          duration: "3–5 weeks",
        },
        {
          title: "Hand over & support",
          detail: "Deployment, documentation, a training session for your team, and a support period to fix issues and tune the system in real use.",
          duration: "1 week + support",
        },
      ],
      deliverables: [
        "A deployed AI assistant connected to your selected documents and tools",
        "Admin panel to update the knowledge base without a developer",
        "Evaluation report: test questions, answer quality and known limits",
        "Technical documentation and source code in your repository",
        "Recorded training session for your team",
      ],
      methodology:
        "I work in four steps — Discover, Design, Build, Hand over & support — with a short written update every week, so you always know where the work stands. Decisions are made with you, not presented to you: you approve the scope after Discover and the design before Build starts.",
      timelineNote:
        "The full engagement takes about 6–8 weeks from the kick-off call, depending on the package and how quickly access to data and people can be arranged.",
      options: [
        {
          id: "essential",
          name: "Essential",
          tagline: "One workflow, done properly.",
          priceCents: 600000,
          recommended: false,
          features: [
            "One workflow and up to two data sources",
            "Web chat interface for your team",
            "30 days of post-launch support",
          ],
          paymentNote: "50% on signing, 50% on handover",
          durationNote: "About 6 weeks",
        },
        {
          id: "professional",
          name: "Professional",
          tagline: "The workflow, connected to the tools you already use.",
          priceCents: 1200000,
          recommended: true,
          features: [
            "Everything in Essential",
            "Up to five data sources and one integration (e.g. CRM, helpdesk, Slack)",
            "Answer-quality evaluation and usage dashboard",
            "60 days of post-launch support",
          ],
          paymentNote: "40% on signing, 30% after Design, 30% on handover",
          durationNote: "About 7 weeks",
        },
        {
          id: "partner",
          name: "Partner",
          tagline: "A longer collaboration across several workflows.",
          priceCents: 2000000,
          recommended: false,
          features: [
            "Everything in Professional",
            "A second workflow or customer-facing assistant",
            "Monthly improvement session for three months",
            "90 days of priority support",
          ],
          paymentNote: "Three equal monthly instalments",
          durationNote: "About 8 weeks + 3 months of improvements",
        },
      ],
      exclusions: [
        "Hardware, third-party licences and AI-model usage fees (billed at cost or directly to you)",
        "Cleaning or rewriting your source documents",
        "Changes to systems outside the agreed integrations",
      ],
      assumptions: [
        "You name one decision-maker and give timely access to data and people (within two working days).",
        "Source documents are available in digital form.",
        "Prices exclude VAT where applicable.",
      ],
      whyMe: [
        "On time and as promised — you get a dated plan and a weekly update.",
        "Practical over impressive: I build what your team will actually use.",
        "Everything I build is documented, so you are never locked in.",
        "I don't disappear after delivery — support is part of every package.",
      ],
      nextSteps: [
        "Choose the package that fits and approve this proposal online.",
        "I send the contract for online signature.",
        "We schedule the kick-off call and start Discover.",
      ],
      termsNote:
        "This proposal is valid until the date shown above. I commit to delivering the work described here with professional care; specific business outcomes depend on many factors outside the project and are not guaranteed. Final terms are set out in the contract.",
    },
  },
  fa: {
    title: "دستیار هوش مصنوعی اختصاصی برای کسب‌وکار شما",
    content: {
      intro:
        "از گفت‌وگوی‌مان ممنونم. این پروپوزال توضیح می‌دهد که ابزار هوش مصنوعی‌ای را که با روش کار فعلی تیم شما جور باشد چطور می‌سازم — چه کاری انجام می‌دهد، چطور به آن می‌رسیم، چه چیزی تحویل می‌گیرید و هزینه‌اش چقدر است.\n\nهدف یک سیستم واقعی است که تیم‌تان هر روز از آن استفاده کند، نه یک دموی نمایشی. هر هفته پیشرفت کار را می‌بینید و بعد از تحویل هم در دسترس هستم.",
      understanding: [
        "تیم شما هر هفته ساعت‌ها صرف کاری تکراری می‌کند که به اطلاعات پراکنده در اسناد، ایمیل‌ها و ابزارهای مختلف وابسته است.",
        "پاسخ‌ها یکدست نیست، چون به اینکه چه کسی در دسترس است و چه چیزی یادش مانده بستگی دارد.",
        "می‌خواهید از هوش مصنوعی استفاده کنید، اما فقط جایی که واقعاً در وقت صرفه‌جویی کند — و بدون اینکه کنترل داده‌هایتان از دست برود.",
      ],
      goals: [
        "کاهش زمانی که صرف فرایند انتخاب‌شده می‌شود، در مقایسه با وضعیت فعلی.",
        "پاسخ‌های یکدست و مستند بر پایه‌ی اسناد خودتان، همراه با نمایش منبع.",
        "سیستمی که تیم شما بتواند اجرا کند، بفهمد و گسترش دهد.",
      ],
      phases: [
        {
          title: "شناخت",
          detail: "جلسه با کسانی که امروز این کار را انجام می‌دهند؛ یک فرایند را که ارزش خودکارسازی دارد انتخاب می‌کنیم و معیار موفقیت را با هم تعیین می‌کنیم.",
          duration: "۱ هفته",
        },
        {
          title: "طراحی",
          detail: "معماری، منابع داده، قواعد حریم خصوصی و دسترسی، و یک نمونه‌ی اولیه‌ی قابل‌کلیک که پیش از ساخت درباره‌اش نظر می‌دهید.",
          duration: "۱ هفته",
        },
        {
          title: "ساخت",
          detail: "توسعه‌ی مرحله‌به‌مرحله با یک نسخه‌ی قابل‌اجرا در هر هفته، آزموده‌شده روی اسناد و سؤال‌های واقعی شما.",
          duration: "۳ تا ۵ هفته",
        },
        {
          title: "تحویل و پشتیبانی",
          detail: "استقرار، مستندسازی، جلسه‌ی آموزش برای تیم، و دوره‌ی پشتیبانی برای رفع اشکال و بهینه‌سازی در استفاده‌ی واقعی.",
          duration: "۱ هفته + پشتیبانی",
        },
      ],
      deliverables: [
        "دستیار هوش مصنوعی مستقرشده و متصل به اسناد و ابزارهای انتخابی شما",
        "پنل مدیریت برای به‌روزرسانی پایگاه دانش بدون نیاز به برنامه‌نویس",
        "گزارش ارزیابی: سؤال‌های آزمون، کیفیت پاسخ‌ها و محدودیت‌های شناخته‌شده",
        "مستندات فنی و کد منبع در مخزن خودتان",
        "جلسه‌ی آموزش ضبط‌شده برای تیم",
      ],
      methodology:
        "در چهار قدم کار می‌کنم — شناخت، طراحی، ساخت، تحویل و پشتیبانی — و هر هفته یک گزارش کوتاه مکتوب می‌فرستم تا همیشه بدانید کار کجاست. تصمیم‌ها با شما گرفته می‌شود، نه اینکه فقط به شما اعلام شود: دامنه‌ی کار را بعد از «شناخت» و طراحی را پیش از شروع «ساخت» تأیید می‌کنید.",
      timelineNote:
        "کل همکاری از جلسه‌ی شروع حدود ۶ تا ۸ هفته طول می‌کشد؛ بسته به بسته‌ی انتخابی و سرعت فراهم‌شدن دسترسی به داده‌ها و افراد.",
      options: [
        {
          id: "essential",
          name: "پایه",
          tagline: "یک فرایند، درست و کامل.",
          priceCents: 600000,
          recommended: false,
          features: ["یک فرایند و حداکثر دو منبع داده", "رابط گفت‌وگوی وب برای تیم", "۳۰ روز پشتیبانی پس از راه‌اندازی"],
          paymentNote: "۵۰٪ هنگام امضا، ۵۰٪ هنگام تحویل",
          durationNote: "حدود ۶ هفته",
        },
        {
          id: "professional",
          name: "حرفه‌ای",
          tagline: "همان فرایند، متصل به ابزارهایی که الان استفاده می‌کنید.",
          priceCents: 1200000,
          recommended: true,
          features: [
            "همه‌ی موارد بسته‌ی پایه",
            "حداکثر پنج منبع داده و یک اتصال (مثلاً CRM، سیستم پشتیبانی یا Slack)",
            "ارزیابی کیفیت پاسخ‌ها و داشبورد استفاده",
            "۶۰ روز پشتیبانی پس از راه‌اندازی",
          ],
          paymentNote: "۴۰٪ هنگام امضا، ۳۰٪ بعد از طراحی، ۳۰٪ هنگام تحویل",
          durationNote: "حدود ۷ هفته",
        },
        {
          id: "partner",
          name: "همکاری بلندمدت",
          tagline: "همکاری طولانی‌تر روی چند فرایند.",
          priceCents: 2000000,
          recommended: false,
          features: [
            "همه‌ی موارد بسته‌ی حرفه‌ای",
            "فرایند دوم یا دستیار مخصوص مشتریان",
            "جلسه‌ی ماهانه‌ی بهبود به مدت سه ماه",
            "۹۰ روز پشتیبانی با اولویت",
          ],
          paymentNote: "سه قسط ماهانه‌ی مساوی",
          durationNote: "حدود ۸ هفته + ۳ ماه بهبود",
        },
      ],
      exclusions: [
        "سخت‌افزار، مجوزهای نرم‌افزاری شخص ثالث و هزینه‌ی استفاده از مدل‌های هوش مصنوعی (به قیمت تمام‌شده یا مستقیماً توسط شما)",
        "پاک‌سازی یا بازنویسی اسناد منبع",
        "تغییر در سیستم‌هایی خارج از اتصال‌های توافق‌شده",
      ],
      assumptions: [
        "یک تصمیم‌گیرنده معرفی می‌کنید و دسترسی به داده‌ها و افراد به‌موقع (حداکثر دو روز کاری) فراهم می‌شود.",
        "اسناد منبع به‌صورت دیجیتال در دسترس است.",
        "قیمت‌ها در صورت شمول، بدون مالیات بر ارزش افزوده است.",
      ],
      whyMe: [
        "سر وقت و طبق قول — برنامه‌ی تاریخ‌دار و گزارش هفتگی می‌گیرید.",
        "کاربردی، نه نمایشی: چیزی می‌سازم که تیم‌تان واقعاً از آن استفاده کند.",
        "همه‌چیز مستند است، پس هیچ‌وقت به من وابسته نمی‌مانید.",
        "بعد از تحویل ناپدید نمی‌شوم — پشتیبانی بخشی از هر بسته است.",
      ],
      nextSteps: [
        "بسته‌ی مناسب را انتخاب کنید و پروپوزال را آنلاین تأیید کنید.",
        "قرارداد را برای تأیید آنلاین برایتان می‌فرستم.",
        "جلسه‌ی شروع را تنظیم می‌کنیم و مرحله‌ی «شناخت» آغاز می‌شود.",
      ],
      termsNote:
        "این پروپوزال تا تاریخ ذکرشده در بالا معتبر است. متعهد می‌شوم کار شرح‌داده‌شده را با دقت حرفه‌ای انجام دهم؛ نتایج مشخص کسب‌وکاری به عوامل زیادی خارج از پروژه بستگی دارد و تضمین نمی‌شود. شرایط نهایی در قرارداد می‌آید.",
    },
  },
};

export function proposalTemplate(key: ProposalTemplateKey, locale: DocLocale): { title: string; content: ProposalContent } {
  if (key === "custom_ai_build") {
    const t = CUSTOM_AI_BUILD[locale];
    return { title: t.title, content: structuredClone(t.content) };
  }
  return { title: "", content: emptyProposalContent() };
}

// -----------------------------------------------------------------------------
// Proposal → document blocks. Empty sections are skipped and the remaining
// ones are numbered consecutively.
// -----------------------------------------------------------------------------

export interface ProposalDocInput {
  locale: DocLocale;
  title: string;
  proposalNo: string;
  revision: number;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
  currency: string;
  validUntil: string | null;
  issuedAt: string;
  selectedOption: string | null;
  content: ProposalContent;
}

const nonEmpty = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);

export function proposalToBlocks(input: ProposalDocInput): DocBlock[] {
  const { locale, content } = input;
  const L = docLabels(locale);
  const blocks: DocBlock[] = [];
  let section = 0;
  const heading = (text: string) => {
    section += 1;
    blocks.push({ type: "heading", level: 1, text: `${localizeDigits(String(section), locale)}. ${text}` });
  };
  const paragraphs = (text: string) => {
    for (const p of text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      blocks.push({ type: "paragraph", text: p.replace(/\n/g, " ") });
    }
  };

  const client = input.clientCompany ? `${input.clientName} · ${input.clientCompany}` : input.clientName;
  blocks.push({ type: "title", text: input.title || "—", subtitle: L.preparedFor(client) });

  const facts: Array<{ label: string; value: string }> = [
    { label: L.proposalNo, value: input.proposalNo },
    { label: L.date, value: formatDate(input.issuedAt, locale) },
  ];
  if (input.validUntil) facts.push({ label: L.validUntil, value: formatDate(input.validUntil, locale) });
  facts.push({ label: L.preparedBy, value: `${L.brandName} · ${"royavosoughi.com"}` });
  if (input.revision > 1) facts.push({ label: L.revision, value: localizeDigits(String(input.revision), locale) });
  blocks.push({ type: "facts", items: facts });

  if (content.intro.trim()) {
    heading(L.sections.summary);
    paragraphs(content.intro);
  }
  const listSection = (label: string, items: string[], ordered = false) => {
    const clean = nonEmpty(items);
    if (!clean.length) return;
    heading(label);
    blocks.push({ type: "list", items: clean, ordered });
  };
  listSection(L.sections.understanding, content.understanding);
  listSection(L.sections.goals, content.goals);

  const phases = content.phases.filter((p) => p.title.trim() || p.detail.trim());
  if (phases.length) {
    heading(L.sections.phases);
    blocks.push({
      type: "table",
      head: [...L.phaseColumns],
      widths: ["36px", "1.1fr", "2.4fr", "1fr"],
      rows: phases.map((p, i) => [localizeDigits(String(i + 1), locale), `**${p.title}**`, p.detail, p.duration]),
    });
  }

  listSection(L.sections.deliverables, content.deliverables);
  if (content.methodology.trim()) {
    heading(L.sections.methodology);
    paragraphs(content.methodology);
  }
  if (content.timelineNote.trim()) {
    heading(L.sections.timeline);
    paragraphs(content.timelineNote);
  }

  if (content.options.length) {
    heading(L.sections.options);
    for (const option of content.options) {
      const selected = input.selectedOption === option.id;
      blocks.push({
        type: "card",
        title: option.name,
        subtitle: option.tagline || undefined,
        price: formatMoney(option.priceCents, input.currency, locale),
        badge: selected ? L.selected : option.recommended ? L.recommended : undefined,
        highlight: selected || (!input.selectedOption && option.recommended),
        items: nonEmpty(option.features),
        notes: [option.durationNote, option.paymentNote].map((s) => s.trim()).filter(Boolean),
      });
    }
  }

  listSection(L.sections.exclusions, content.exclusions);
  listSection(L.sections.assumptions, content.assumptions);
  listSection(L.sections.whyMe, content.whyMe);
  listSection(L.sections.nextSteps, content.nextSteps, true);
  if (content.termsNote.trim()) {
    heading(L.sections.terms);
    paragraphs(content.termsNote);
  }

  return blocks;
}

/** Body of create/update requests from the proposal editor. */
export const ProposalInputSchema = z.object({
  locale: z.enum(["en", "fa"]),
  contactId: z.string().uuid().nullable(),
  dealId: z.string().uuid().nullable(),
  clientName: z.string().trim().min(1).max(200),
  clientEmail: z.string().trim().email().max(320),
  clientCompany: z.string().trim().max(200).nullable(),
  clientPhone: z.string().trim().max(60).nullable(),
  title: z.string().trim().min(1).max(300),
  content: ProposalContentSchema,
  currency: z.string().trim().length(3),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type ProposalInputBody = z.infer<typeof ProposalInputSchema>;

/** The package a contract is built from: the client's choice, else the recommended one, else the first. */
export function pickOption(content: ProposalContent, selectedId: string | null): ProposalOption | null {
  return (
    content.options.find((o) => o.id === selectedId) ??
    content.options.find((o) => o.recommended) ??
    content.options[0] ??
    null
  );
}
