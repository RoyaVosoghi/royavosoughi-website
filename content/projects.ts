/**
 * Portfolio entries.
 *
 * Per the brand guide: every project must be deployed, open source and
 * documented — "a portfolio you can run, not claims you have to trust".
 * So each entry needs a real demo URL and a real repo before it can ship.
 *
 * `draft: true` entries are visible in `npm run dev` only. They never render
 * in production, so nothing unfinished or invented reaches a visitor.
 * To publish: fill in every field, set draft to false.
 */

export type ProjectCopy = {
  /** What it is, in one line */
  title: string;
  /** The problem it solves, in the client's language — not the tech stack */
  problem: string;
  /** The guide's required "what I learned" line */
  learned: string;
};

export type Project = {
  slug: string;
  draft: boolean;
  year: string;
  /** Shown as monospace chips. Not translated — tech names are tech names. */
  tags: string[];
  links: {
    demo?: string;
    github?: string;
  };
  en: ProjectCopy;
  fa: ProjectCopy;
};

export const projects: Project[] = [
  {
    slug: "rag-knowledge-assistant",
    draft: true,
    year: "2026",
    tags: ["Python", "RAG", "LangChain", "pgvector"],
    links: {
      demo: "",
      github: "",
    },
    en: {
      title: "Internal knowledge assistant",
      problem:
        "Teams lose hours hunting through scattered documents. This answers questions from a company's own files, and cites the source of every answer.",
      learned:
        "Retrieval quality decides everything — a better embedding strategy beat a bigger model every time.",
    },
    fa: {
      title: "دستیار دانش داخلی",
      problem:
        "تیم‌ها ساعت‌ها وقت می‌گذارند تا لای اسناد پراکنده دنبال یک جواب بگردند. این ابزار از روی فایل‌های خود شرکت جواب می‌دهد و منبع هر جواب را هم نشان می‌دهد.",
      learned:
        "کیفیت بازیابی اطلاعات همه‌چیز را تعیین می‌کند — یک استراتژی بهتر برای embedding، هر بار از یک مدل بزرگ‌تر جلو زد.",
    },
  },
  {
    slug: "support-triage-agent",
    draft: true,
    year: "2026",
    tags: ["Python", "LLM", "FastAPI", "Postgres"],
    links: {
      demo: "",
      github: "",
    },
    en: {
      title: "Support triage agent",
      problem:
        "Incoming support messages get read, sorted and routed by hand. This reads them first, tags them, and escalates only what actually needs a person.",
      learned:
        "The hard part was not the model — it was deciding what the agent is not allowed to answer on its own.",
    },
    fa: {
      title: "ایجنت دسته‌بندی پشتیبانی",
      problem:
        "پیام‌های پشتیبانی دستی خوانده، دسته‌بندی و ارجاع داده می‌شوند. این ایجنت اول آن‌ها را می‌خواند، برچسب می‌زند و فقط چیزی را بالا می‌فرستد که واقعا به آدم نیاز دارد.",
      learned:
        "بخش سخت کار مدل نبود — تصمیم‌گیری درباره‌ی این بود که ایجنت اجازه ندارد به چه چیزهایی خودش جواب بدهد.",
    },
  },
];

/** Drafts are for local review only. */
export function visibleProjects(): Project[] {
  if (process.env.NODE_ENV === "development") return projects;
  return projects.filter((project) => !project.draft);
}
