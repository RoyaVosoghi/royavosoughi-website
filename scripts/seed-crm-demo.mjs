// Demo data for the CRM — fills every screen for a walkthrough or a class demo.
//
//   node --env-file=.env.local scripts/seed-crm-demo.mjs          # insert
//   node --env-file=.env.local scripts/seed-crm-demo.mjs --clean  # remove it again
//
// Everything it creates is marked so --clean can find it and nothing else:
// emails end in @demo.example (a reserved, undeliverable domain), company
// notes are "[demo]", chat conversations use external ids starting "demo-".
// All people and companies are fictional. Re-running without --clean first
// cleans, then seeds, so it never duplicates.

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const DOMAIN = "demo.example";
const DAY = 86_400_000;
const ago = (days, hour = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const ahead = (days, hour = 10) => ago(-days, hour);

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) {
    console.error(`✗ ${label}:`, error.message);
    process.exit(1);
  }
  return data;
}

async function clean() {
  const like = `%@${DOMAIN}`;
  // Optional V5 tables — ignore "does not exist" if the V5 block hasn't been run.
  for (const [table, column] of [
    ["contracts", "client_email"],
    ["proposals", "client_email"],
    ["campaign_emails", "to_email"],
  ]) {
    const { error } = await db.from(table).delete().like(column, like);
    if (error && !/does not exist|could not find/i.test(error.message)) console.warn(`  ! ${table}:`, error.message);
  }
  await must(db.from("contacts").delete().like("email", like), "delete contacts"); // deals + activities cascade
  await must(db.from("leads").delete().like("email", like), "delete leads");
  await must(db.from("conversations").delete().like("external_user_id", "demo-%"), "delete conversations"); // messages cascade
  await must(db.from("companies").delete().eq("notes", "[demo]"), "delete companies");
  console.log("✓ demo data removed");
}

// -----------------------------------------------------------------------------
// The cast — fictional businesses from both of Roya's markets.
// -----------------------------------------------------------------------------

const COMPANIES = [
  { key: "lumen", name: "Lumen Logistics", industry: "Logistics", domain: "lumen-logistics.demo.example" },
  { key: "brightdesk", name: "BrightDesk Accounting", industry: "Accounting", domain: "brightdesk.demo.example" },
  { key: "verde", name: "Casa Verde Interiors", industry: "Retail / interiors", domain: "casaverde.demo.example" },
  { key: "northpeak", name: "NorthPeak Clinics", industry: "Healthcare", domain: "northpeak.demo.example" },
  { key: "orbit", name: "Orbit Language School", industry: "Education", domain: "orbit-lang.demo.example" },
  { key: "pars", name: "پارس‌تجارت آریا", industry: "واردات و توزیع", domain: "parstejarat.demo.example" },
  { key: "nikan", name: "دفتر حقوقی نیکان", industry: "خدمات حقوقی", domain: "nikan-law.demo.example" },
  { key: "sepid", name: "کلینیک دندان‌پزشکی سپید", industry: "سلامت", domain: "sepid-dental.demo.example" },
  { key: "atlas", name: "Atlas Property Group", industry: "Real estate", domain: "atlas-property.demo.example" },
  { key: "kooch", name: "آژانس گردشگری کوچ", industry: "گردشگری", domain: "kooch-travel.demo.example" },
];

// stage: index into the pipeline (0 New … 3 Negotiation) or "won"/"lost".
const PEOPLE = [
  { name: "Marta Keller", email: "marta.keller", company: "lumen", title: "Operations Director", locale: "en", source: "web",
    challenge: "Our dispatchers answer the same delivery-status questions 200 times a day from email and phone.",
    deal: { title: "Dispatcher support assistant", amount: 12000, stage: 3, days: 21 } },
  { name: "Daniel Osei", email: "daniel.osei", company: "brightdesk", title: "Managing Partner", locale: "en", source: "widget",
    challenge: "Clients send us scanned receipts in every format; we re-type them into the ledger by hand.",
    deal: { title: "Receipt extraction pipeline", amount: 9000, stage: 2, days: 9 } },
  { name: "Giulia Ferraro", email: "giulia.ferraro", company: "verde", title: "Founder", locale: "en", source: "web",
    challenge: "We want a product assistant on our site that knows our whole catalogue and fabrics.",
    deal: { title: "Catalogue assistant for the web shop", amount: 6000, stage: "won", closedDaysAgo: 40 } },
  { name: "Dr. Hannah Brooks", email: "hannah.brooks", company: "northpeak", title: "Head of Patient Services", locale: "en", source: "web",
    challenge: "Front desk is overwhelmed by appointment and insurance questions.",
    deal: { title: "Patient FAQ assistant (pilot)", amount: 8000, stage: 1, days: 4 } },
  { name: "Tom Lindqvist", email: "tom.lindqvist", company: "orbit", title: "Director", locale: "en", source: "telegram",
    challenge: "Teachers spend evenings writing personalised feedback for every student.",
    deal: { title: "Feedback drafting tool for teachers", amount: 5000, stage: "lost", closedDaysAgo: 75 } },
  { name: "سارا محمدی", email: "sara.mohammadi", company: "pars", title: "مدیر عامل", locale: "fa", source: "web",
    challenge: "کارشناسان فروش ما هر روز ساعت‌ها دنبال موجودی و قیمت در فایل‌های اکسل مختلف می‌گردند.",
    deal: { title: "دستیار موجودی و قیمت برای تیم فروش", amount: 14000, stage: 3, days: 30 } },
  { name: "علی رضایی", email: "ali.rezaei", company: "nikan", title: "شریک ارشد", locale: "fa", source: "widget",
    challenge: "می‌خواهیم قراردادهای تکراری را سریع‌تر بررسی کنیم و بندهای پرریسک را پیدا کنیم.",
    deal: { title: "ابزار بررسی بندهای قرارداد", amount: 11000, stage: "won", closedDaysAgo: 120 } },
  { name: "مریم کاظمی", email: "maryam.kazemi", company: "sepid", title: "مدیر کلینیک", locale: "fa", source: "web",
    challenge: "منشی‌ها وقت زیادی صرف پاسخ به سؤال‌های تکراری بیماران در واتس‌اپ می‌کنند.",
    deal: { title: "پاسخ‌گوی هوشمند نوبت‌دهی", amount: 4500, stage: 0, days: 2 } },
  { name: "Ethan Novak", email: "ethan.novak", company: "atlas", title: "COO", locale: "en", source: "web",
    challenge: "Agents rewrite the same property descriptions for five different portals.",
    deal: { title: "Listing copy generator", amount: 7000, stage: "won", closedDaysAgo: 200 } },
  { name: "رضا حسینی", email: "reza.hosseini", company: "kooch", title: "مدیر فروش", locale: "fa", source: "telegram",
    challenge: "پیشنهاد سفر برای هر مشتری را دستی از چند منبع جمع می‌کنیم.",
    deal: { title: "سازنده‌ی پیشنهاد سفر شخصی", amount: 6500, stage: "lost", closedDaysAgo: 160 } },
  { name: "Lena Fischer", email: "lena.fischer", company: "lumen", title: "IT Manager", locale: "en", source: "web",
    challenge: "Need the assistant to plug into our existing ticketing system.",
    deal: { title: "Ticketing integration (phase 2)", amount: 4000, stage: "won", closedDaysAgo: 15 } },
  { name: "Omar Haddad", email: "omar.haddad", company: "brightdesk", title: "Senior Accountant", locale: "en", source: "widget",
    challenge: "Month-end reconciliation notes take two days to write.",
    deal: { title: "Reconciliation notes drafting", amount: 3500, stage: "won", closedDaysAgo: 290 } },
  { name: "نگار احمدی", email: "negar.ahmadi", company: "pars", title: "مدیر بازاریابی", locale: "fa", source: "web",
    challenge: "می‌خواهیم پاسخ ایمیل‌های مشتریان عمده‌فروش سریع‌تر و یکدست‌تر شود.",
    deal: { title: "دستیار پاسخ ایمیل مشتریان", amount: 5500, stage: 1, days: 12 } },
  { name: "Chloe Martin", email: "chloe.martin", company: "verde", title: "E-commerce Lead", locale: "en", source: "web",
    challenge: "Returns questions flood our inbox after every sale.",
    deal: { title: "Returns & delivery assistant", amount: 3000, stage: "won", closedDaysAgo: 250 } },
  { name: "Paul Wagner", email: "paul.wagner", company: "northpeak", title: "Finance Director", locale: "en", source: "web",
    challenge: "Budget approval needs a clear ROI estimate before we commit.",
    deal: { title: "Insurance pre-check assistant", amount: 9500, stage: "lost", closedDaysAgo: 330 } },
];

const FRESH_LEADS = [
  { name: "Isabel Moreau", email: "isabel.moreau", company: "Moreau Bakeries", locale: "en", source: "web", score: 82,
    interest: "We have 6 bakeries and want staff to get recipe and allergen answers instantly instead of calling head office." },
  { name: "James Whitaker", email: "james.whitaker", company: "Whitaker & Sons Plumbing", locale: "en", source: "widget", score: 55,
    interest: "Can AI answer quote requests out of hours?" },
  { name: "کیان صالحی", email: "kian.salehi", company: "استودیو معماری صالحی", locale: "fa", source: "web", score: 71,
    interest: "می‌خواهیم توضیحات پروژه‌ها و قراردادهای قبلی را برای پیشنهاد قیمت جدید سریع پیدا کنیم." },
  { name: "Sophie Laurent", email: "sophie.laurent", company: null, locale: "en", source: "telegram", score: 30,
    interest: "Just curious what AI could do for a small online shop." },
];

const CONVERSATIONS = {
  "marta.keller": [
    ["user", "Hi — we run a logistics company and our dispatchers get flooded with 'where is my delivery' questions."],
    ["assistant", "That's a very common pattern. Roughly how many of those questions come in per day, and where does the delivery status live today?"],
    ["user", "About 200 a day. Status is in our TMS, but customers email and call. We'd need it in English and German, and IT is cautious about data leaving our servers."],
    ["assistant", "Understood — multilingual answers grounded in your TMS data, with a privacy-first setup. Shall I pass this to Roya so she can propose a scoped pilot?"],
    ["user", "Yes please, budget is approved for this quarter if the pilot shows results."],
  ],
  "sara.mohammadi": [
    ["user", "سلام، تیم فروش ما برای هر سفارش باید موجودی و قیمت را در چند فایل اکسل پیدا کند."],
    ["assistant", "سلام! چند نفر در تیم فروش هستند و این فایل‌ها کجا نگهداری می‌شوند؟"],
    ["user", "دوازده نفر هستیم. فایل‌ها روی گوگل‌درایو است و هر هفته به‌روز می‌شود. مهم است که اشتباه قیمت ندهیم."],
    ["assistant", "دستیاری که مستقیم از همان فایل‌ها با ذکر منبع جواب بدهد، دقیقاً برای این کار مناسب است. اطلاعات شما را برای رویا می‌فرستم."],
  ],
};

async function seed() {
  const stages = await must(db.from("pipeline_stages").select("id, name, sort_order, is_won, is_lost").order("sort_order"), "read stages");
  const open = stages.filter((s) => !s.is_won && !s.is_lost);
  const won = stages.find((s) => s.is_won);
  const lost = stages.find((s) => s.is_lost);
  if (!open.length || !won || !lost) {
    console.error("✗ pipeline needs at least one open, one won and one lost stage");
    process.exit(1);
  }

  const companies = await must(
    db.from("companies").insert(COMPANIES.map((c) => ({ name: c.name, industry: c.industry, domain: c.domain, notes: "[demo]" }))).select("id, name"),
    "insert companies",
  );
  const companyId = Object.fromEntries(COMPANIES.map((c) => [c.key, companies.find((row) => row.name === c.name).id]));

  // Converted leads for everyone in PEOPLE, so the contact timeline starts with the original enquiry.
  const leads = await must(
    db
      .from("leads")
      .insert(
        PEOPLE.map((p, i) => ({
          name: p.name,
          email: `${p.email}@${DOMAIN}`,
          interest: p.challenge,
          source: p.source,
          locale: p.locale,
          status: "converted",
          company_name: COMPANIES.find((c) => c.key === p.company).name,
          created_at: ago(30 + i * 22),
          notes: "[demo]",
        })),
      )
      .select("id, email"),
    "insert converted leads",
  );

  const contacts = await must(
    db
      .from("contacts")
      .insert(
        PEOPLE.map((p, i) => ({
          lead_id: leads.find((l) => l.email === `${p.email}@${DOMAIN}`).id,
          company_id: companyId[p.company],
          name: p.name,
          email: `${p.email}@${DOMAIN}`,
          title: p.title,
          status: p.deal.stage === "won" ? "customer" : "active",
          source: p.source,
          locale: p.locale,
          created_at: ago(28 + i * 22),
        })),
      )
      .select("id, email"),
    "insert contacts",
  );
  const contactByKey = Object.fromEntries(PEOPLE.map((p) => [p.email, contacts.find((c) => c.email === `${p.email}@${DOMAIN}`)]));

  const deals = await must(
    db
      .from("deals")
      .insert(
        PEOPLE.map((p) => {
          const d = p.deal;
          const closed = d.stage === "won" || d.stage === "lost";
          const stage = d.stage === "won" ? won : d.stage === "lost" ? lost : open[Math.min(d.stage, open.length - 1)];
          return {
            contact_id: contactByKey[p.email].id,
            company_id: companyId[p.company],
            pipeline_stage_id: stage.id,
            title: d.title,
            amount_cents: d.amount * 100,
            currency: "EUR",
            status: d.stage === "won" ? "won" : d.stage === "lost" ? "lost" : "open",
            closed_at: closed ? ago(d.closedDaysAgo, 15) : null,
            expected_close_date: closed ? null : ahead(14 + (d.days ?? 0)).slice(0, 10),
            created_at: ago((d.closedDaysAgo ?? d.days ?? 0) + 25),
            updated_at: closed ? ago(d.closedDaysAgo, 15) : ago(d.days ?? 0),
          };
        }),
      )
      .select("id, contact_id, title, status"),
    "insert deals",
  );

  // Activities: overdue, due today, upcoming, done, plus stage-change notes.
  const activities = [];
  for (const [i, p] of PEOPLE.entries()) {
    const contact = contactByKey[p.email];
    const deal = deals.find((d) => d.contact_id === contact.id);
    activities.push({ contact_id: contact.id, deal_id: null, type: "note", subject: "Lead converted to contact", body: p.challenge, created_at: ago(28 + i * 22) });
    activities.push({ contact_id: contact.id, deal_id: deal.id, type: "call", subject: "Discovery call", completed_at: ago(20 + i), due_at: ago(20 + i), created_at: ago(22 + i) });
    if (deal.status === "open") {
      const bucket = i % 3;
      const due = bucket === 0 ? ago(3 + i, 9) : bucket === 1 ? ahead(0, 16) : ahead(4 + i, 11);
      activities.push({
        contact_id: contact.id,
        deal_id: deal.id,
        type: "task",
        subject: bucket === 0 ? "Send revised scope" : bucket === 1 ? "Follow up on proposal questions" : "Prepare demo with client documents",
        due_at: due,
        created_at: ago(6),
      });
      activities.push({ contact_id: contact.id, deal_id: deal.id, type: "meeting", subject: "Scoping workshop", due_at: ahead(7 + i, 14), created_at: ago(5) });
    } else {
      activities.push({
        contact_id: contact.id,
        deal_id: deal.id,
        type: "note",
        subject: `Stage changed → ${deal.status === "won" ? won.name : lost.name}`,
        created_at: ago(p.deal.closedDaysAgo, 15),
      });
    }
  }
  await must(db.from("activities").insert(activities), "insert activities");

  // Fresh, unconverted leads for a live "convert" demo.
  await must(
    db.from("leads").insert(
      FRESH_LEADS.map((l, i) => ({
        name: l.name,
        email: `${l.email}@${DOMAIN}`,
        interest: l.interest,
        source: l.source,
        locale: l.locale,
        status: i === 3 ? "contacted" : "new",
        company_name: l.company,
        ai_score: l.score,
        ai_score_reason: l.score > 70 ? "Specific, recurring problem with a clear team and budget signal." : "Interest is real but vague; no clear scope yet.",
        ai_score_updated_at: ago(0),
        created_at: ago(i === 3 ? 12 : i + 1),
        notes: "[demo]",
      })),
    ),
    "insert fresh leads",
  );

  // Chatbot conversations, linked to contacts through lead_email (how the contact timeline finds them).
  for (const [emailKey, turns] of Object.entries(CONVERSATIONS)) {
    const person = PEOPLE.find((p) => p.email === emailKey);
    const [conversation] = await must(
      db
        .from("conversations")
        .insert({
          channel: "web",
          external_user_id: `demo-${emailKey}`,
          locale: person.locale,
          lead_email: `${emailKey}@${DOMAIN}`,
          status: "closed",
          started_at: ago(32, 9),
          last_active_at: ago(32, 10),
        })
        .select("id"),
      "insert conversation",
    );
    await must(
      db.from("messages").insert(turns.map(([role, content], i) => ({ conversation_id: conversation.id, role, content, created_at: new Date(Date.parse(ago(32, 9)) + i * 60_000).toISOString() }))),
      "insert messages",
    );
    await db.from("leads").update({ conversation_id: conversation.id }).eq("email", `${emailKey}@${DOMAIN}`);
  }

  // One approved proposal ready to convert, if the V5 tables exist.
  const marta = PEOPLE[0];
  const martaDeal = deals.find((d) => d.contact_id === contactByKey[marta.email].id);
  const { error: proposalError } = await db.from("proposals").insert({
    proposal_no: "RV-P-DEMO-001", // outside the RV-P-<year>-NNN series, so it never bumps real numbering
    locale: "en",
    contact_id: contactByKey[marta.email].id,
    deal_id: martaDeal.id,
    client_name: marta.name,
    client_email: `${marta.email}@${DOMAIN}`,
    client_company: "Lumen Logistics",
    title: "Dispatcher support assistant",
    currency: "EUR",
    valid_until: ahead(20).slice(0, 10),
    status: "approved",
    view_token: randomBytes(24).toString("base64url"),
    revision: 1,
    sent_at: ago(6),
    first_viewed_at: ago(5),
    last_viewed_at: ago(2),
    view_count: 4,
    responded_at: ago(2),
    selected_option: "professional",
    responder_name: marta.name,
    content: {
      intro: "A multilingual assistant that answers delivery-status questions from your TMS, so dispatchers can focus on exceptions.",
      understanding: ["About 200 status questions a day arrive by email and phone.", "Answers must come from the TMS, in English and German.", "Data must stay under your control."],
      goals: ["Answer routine status questions automatically, with the source shown.", "Hand anything unusual to a dispatcher with full context."],
      phases: [
        { title: "Discover", detail: "Map the top question types and TMS fields.", duration: "1 week" },
        { title: "Design", detail: "Architecture, privacy rules and a clickable prototype.", duration: "1 week" },
        { title: "Build", detail: "Weekly working versions tested on real questions.", duration: "4 weeks" },
        { title: "Hand over & support", detail: "Deployment, training and 60 days of support.", duration: "1 week + support" },
      ],
      deliverables: ["Deployed assistant connected to the TMS", "Admin panel", "Evaluation report", "Documentation and source code"],
      methodology: "Four steps — Discover, Design, Build, Hand over & support — with a written update every week.",
      timelineNote: "About 7 weeks from kick-off.",
      options: [
        { id: "essential", name: "Essential", tagline: "Email channel only.", priceCents: 800000, recommended: false, features: ["Email channel", "English only", "30 days support"], paymentNote: "50% on signing, 50% on handover", durationNote: "About 6 weeks" },
        { id: "professional", name: "Professional", tagline: "Email + phone transcripts, two languages.", priceCents: 1200000, recommended: true, features: ["Email and phone transcripts", "English and German", "60 days support"], paymentNote: "40% on signing, 30% after Design, 30% on handover", durationNote: "About 7 weeks" },
      ],
      exclusions: ["Changes to the TMS itself", "Telephony hardware"],
      assumptions: ["Read-only API access to the TMS is available."],
      whyMe: ["On time and as promised.", "Practical over impressive.", "Support after delivery."],
      nextSteps: ["Approve online", "Sign the contract", "Kick-off call"],
      termsNote: "Valid until the date above. I commit to the work, not to specific business outcomes.",
    },
  });
  if (proposalError) console.warn("  ! proposal skipped (run the V5 SQL block to include it):", proposalError.message);

  console.log(`✓ seeded ${COMPANIES.length} companies, ${PEOPLE.length} contacts + deals, ${activities.length} activities, ${FRESH_LEADS.length} fresh leads, ${Object.keys(CONVERSATIONS).length} chat conversations${proposalError ? "" : ", 1 approved proposal"}`);
}

const onlyClean = process.argv.includes("--clean");
await clean();
if (!onlyClean) await seed();
