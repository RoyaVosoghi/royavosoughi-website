import type { DocLocale } from "./format";

/**
 * Words printed INSIDE client documents. Deliberately separate from the admin
 * i18n tree: a document's language is chosen per document, independent of
 * the language the admin panel happens to be in.
 */
export const DOC_LABELS = {
  en: {
    brandName: "Roya Vosoughi",
    slogan: "AI engineered for reality",
    proposal: "Proposal",
    contract: "Contract",
    page: (n: string, total: string) => `Page ${n} of ${total}`,
    preparedFor: (name: string) => `Prepared for ${name}`,
    proposalNo: "Proposal no.",
    contractNo: "Contract no.",
    date: "Date",
    validUntil: "Valid until",
    preparedBy: "Prepared by",
    revision: "Revision",
    draftNo: "DRAFT",
    sections: {
      summary: "Summary",
      understanding: "Our understanding of your situation",
      goals: "Goals",
      phases: "Delivery plan",
      deliverables: "Deliverables",
      methodology: "How I work",
      timeline: "Timeline",
      options: "Packages & investment",
      exclusions: "Out of scope",
      assumptions: "Assumptions",
      whyMe: "Why work with me",
      nextSteps: "Next steps",
      terms: "Terms",
    },
    phaseColumns: ["#", "Phase", "What happens", "Duration"],
    recommended: "Recommended",
    selected: "Your choice",
    signature: {
      consultant: "Consultant",
      client: "Client",
      issued: "Issued electronically",
      acceptedBy: (name: string) => `Accepted online by ${name}`,
      acceptedAt: (when: string) => `On ${when}`,
      fromIp: (ip: string) => `From IP ${ip}`,
      awaiting: "Awaiting online acceptance",
    },
  },
  fa: {
    brandName: "Roya Vosoughi",
    slogan: "هوش مصنوعی، مهندسی‌شده برای واقعیت",
    proposal: "پروپوزال",
    contract: "قرارداد",
    page: (n: string, total: string) => `صفحه‌ی ${n} از ${total}`,
    preparedFor: (name: string) => `تهیه‌شده برای ${name}`,
    proposalNo: "شماره‌ی پروپوزال",
    contractNo: "شماره‌ی قرارداد",
    date: "تاریخ",
    validUntil: "اعتبار تا",
    preparedBy: "تهیه‌کننده",
    revision: "نسخه",
    draftNo: "پیش‌نویس",
    sections: {
      summary: "خلاصه",
      understanding: "درک من از وضعیت شما",
      goals: "اهداف",
      phases: "مراحل اجرا",
      deliverables: "خروجی‌ها",
      methodology: "روش کار",
      timeline: "زمان‌بندی",
      options: "بسته‌ها و هزینه",
      exclusions: "موارد خارج از دامنه",
      assumptions: "پیش‌فرض‌ها",
      whyMe: "چرا با من کار کنید",
      nextSteps: "گام‌های بعدی",
      terms: "شرایط",
    },
    phaseColumns: ["#", "مرحله", "چه اتفاقی می‌افتد", "مدت"],
    recommended: "پیشنهاد من",
    selected: "انتخاب شما",
    signature: {
      consultant: "مشاور",
      client: "کارفرما",
      issued: "صادرشده به‌صورت الکترونیکی",
      acceptedBy: (name: string) => `تأییدشده به‌صورت آنلاین توسط ${name}`,
      acceptedAt: (when: string) => `در ${when}`,
      fromIp: (ip: string) => `از IP ${ip}`,
      awaiting: "در انتظار تأیید آنلاین",
    },
  },
} as const;

export function docLabels(locale: DocLocale) {
  return DOC_LABELS[locale];
}
