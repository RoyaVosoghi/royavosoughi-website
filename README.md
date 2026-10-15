# royavosoughi.com

Personal brand site for **Roya Vosoughi** — AI Engineer & Software Developer.
Bilingual (English + Persian), built from [Roya_Brand_Guide.md](Roya_Brand_Guide.md).

> Building a dream, line by line. · رویا رو خط‌به‌خط می‌سازم

---

## Run it locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — you land on `/en`. Persian is at `/fa`.

The site runs **without any accounts or keys**. The contact form detects that
Supabase is missing and shows a `mailto:` link instead of a form that would
silently drop messages.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build — must pass before deploying |
| `npm run typecheck` | TypeScript only, no build |
| `npm run lint` | Next.js lint |

---

## Setup checklist

Do these in order. Everything is free.

### 1. GitHub (needed for Vercel)

Create an account at <https://github.com>, then from this folder:

```bash
git init
git add .
git commit -m "Initial website"
git branch -M main
git remote add origin https://github.com/<your-username>/website.git
git push -u origin main
```

`.env.local` is git-ignored — real keys never get committed.

### 2. Supabase (turns the contact form on)

1. Create a project at <https://supabase.com> (free tier).
2. Open **SQL Editor → New query**, paste all of
   [supabase/schema.sql](supabase/schema.sql), and press **Run**.
3. Go to **Project Settings → API** and copy two values.
4. Copy `.env.local.example` to `.env.local` and paste them in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

5. Restart `npm run dev`. The contact form replaces the mailto fallback.

Messages arrive in **Table Editor → contact_messages**. The anon key can only
INSERT — it cannot read a single message, so publishing it in the browser is safe.

### 3. Vercel (deploy)

1. Sign in to <https://vercel.com> with GitHub.
2. **Add New → Project** → import the repo. It auto-detects Next.js.
3. Under **Environment Variables**, add the same three keys, but set
   `NEXT_PUBLIC_SITE_URL=https://royavosoughi.com`.
4. Deploy. Every later `git push` redeploys automatically.

### 4. Domain

Buy `royavosoughi.com`, then in Vercel: **Project → Settings → Domains → Add**.
Vercel shows the exact DNS records to paste at your registrar.

---

## Editing the site

Almost everything is text in two files. **No English or Persian is hardcoded in
components** — if a string is on screen, it lives in `messages/`.

| I want to change… | Edit |
|---|---|
| Any wording, EN | [messages/en.json](messages/en.json) |
| Any wording, FA | [messages/fa.json](messages/fa.json) |
| Projects shown | [content/projects.ts](content/projects.ts) |
| Email, LinkedIn, GitHub | [lib/site.ts](lib/site.ts) |
| Colours, fonts, type scale | [app/globals.css](app/globals.css) |

The two message files must stay in sync: **add a key to one, add it to the
other**, or the missing locale throws at build time.

### Adding a project

Open `content/projects.ts`, fill in every field, and set `draft: false`.

Draft entries render only in `npm run dev` — never in production. That is on
purpose: per the brand guide, a project appears publicly only once it is
deployed, open source and documented. Right now both entries are drafts with
empty links, so the live site shows an honest "first projects are being built"
message instead.

### Admin panel

`/admin` is an internal dashboard — leads, registrations, and every chatbot
conversation across web/widget/Telegram, all reading the same tables the
brain writes to. Password-gated: set `ADMIN_PASSWORD` and
`ADMIN_SESSION_SECRET` in the environment (see `.env.local.example`), then
sign in at `/admin/login`. It's deliberately outside `app/[locale]/` — one
operator, one language, no visitor ever needs to land there.

### CRM

The admin panel's **CRM** group follows the classic flow: an inbound **lead**
(contact form or chatbot `capture_lead`) stays untouched until someone
deliberately **converts** it into a **contact** + **company** (+ optional
**deal**); from then on activities, proposals, contracts, campaigns and AI
insight all hang off the contact.

| Page | What it does |
|---|---|
| Leads | Inbound queue, AI score (0–100), convert to contact |
| Contacts / Companies | 360° contact page: AI summary, deals, documents, timeline incl. chatbot conversations |
| Deals | Kanban over admin-editable `pipeline_stages`; won/lost status follows the stage flags; AI next action |
| Activities | Calls, meetings, notes, tasks; overdue tasks also on the dashboard |
| Proposals | Branded A4 proposal (EN or FA per document) with live preview, PDF, email, public page where the client picks a package and approves / requests changes / declines |
| Contracts | 13-article contract (Markdown, auto-numbered), AI rewrite, PDF, email, public page with two-phase online acceptance, AI follow-up |
| Campaigns | Code-defined segments → AI writes one personal email per recipient → you review/edit/skip → send |
| Reports | Funnel, pipeline value per stage, lead sources, revenue by month |
| Assistant | Chat with your CRM: streaming, answers only from four read-only tools |

**Where the code lives**

```
lib/admin/queries.ts      V1–V4 data access (leads, contacts, deals, activities, reports)
lib/admin/crm-docs.ts     proposals, contracts, campaigns (conditional updates = no double submits)
lib/admin/api.ts          route plumbing: role gate → zod → op → typed audit → response
lib/crm/                  isomorphic: formats & amount-in-words, doc blocks + Markdown, proposal
                          templates, 13-article contract template, segments, in-document labels
lib/ai/crm-writer.ts      contract rewrite / follow-up / campaign email (zod-validated, 1 retry)
lib/ai/crm-assistant.ts   streaming tool-calling assistant (query_leads, query_deals,
                          query_activities, crm_stats)
lib/email/crm.ts          branded email via Resend (PDF attachments)
components/docs/A4Document.tsx   the A4 engine: measure every block off-screen, then paginate;
                          lists/tables split across pages; PDF via html2canvas-pro + jsPDF
app/(documents)/          public /proposal/<token> and /contract/<token> pages (no login)
```

PDFs are rendered **in the browser** (each 794×1123px page → JPEG → A4 PDF),
so Persian is shaped by the browser with the real Vazirmatn font — no
server-side font shaping. Quality steps down until the file is under ~2.9MB,
because the base64 travels in a JSON body and Vercel rejects bodies over 4.5MB.

**Setup**

1. In Supabase → SQL Editor run, in order: the whole file once if this is a
   fresh project, otherwise just the blocks you haven't run yet — **V4 (CRM
   core)**, **V5 (CRM documents & outreach)**, then **V6 (Blog)** in
   [supabase/schema.sql](supabase/schema.sql). Pages for proposals, contracts
   and campaigns show a "run the V5 SQL block" notice until V5 exists.
2. Environment variables (besides the Supabase/admin ones above):

| Variable | Needed for |
|---|---|
| `OPENROUTER_API_KEY` | lead scoring, summaries, next action, contract rewrite/follow-up, campaign drafts, assistant |
| `RESEND_API_KEY` | emailing proposals, contracts, signed copies, campaign emails |
| `RESEND_FROM_EMAIL` | sender, e.g. `Roya Vosoughi <hello@royavosoughi.com>` — **must be on a domain verified in Resend**; the default sandbox sender only delivers to your own Resend account address |
| `CRM_NOTIFY_EMAIL` | where client responses/acceptances are announced (falls back to `CONTACT_NOTIFICATION_EMAIL`, then the site email) |

Without `RESEND_API_KEY` everything still works up to sending: use **"Mark as
sent & copy link"** and share the client link yourself. Without
`OPENROUTER_API_KEY` the AI buttons show a clear message instead of failing.

**Demo data** — fictional companies/contacts/deals/activities/leads, two chatbot
conversations and an approved proposal, all tagged (`@demo.example` emails):

```bash
node --env-file=.env.local scripts/seed-crm-demo.mjs          # seed (cleans first)
node --env-file=.env.local scripts/seed-crm-demo.mjs --clean  # remove
```

**Demo scenario** (≈10 minutes): Leads → convert *Isabel Moreau* (with a
deal) → her contact page → *New proposal* → apply the *Custom AI build*
template → *Save & send* (or *Mark as sent & copy link*) → open the client
link in a private window → choose *Professional*, approve → back in admin the
proposal shows *Approved* → *Convert to contract* → *Rewrite with AI* → save →
send → open the contract link → accept with your name → signed PDF → drag the
deal to *Won* → Reports shows the revenue → ask the Assistant "How much did I
win this month?".

### Blog

`/en/blog` and `/fa/blog` list published posts; each post lives at
`/<locale>/blog/<slug>`. Posts are written in **Admin → Content → Blog**
(Markdown with live preview), one row per language — give the English and
Persian versions the same slug and each article links to the other. Drafts are
never public; publishing refreshes the cached pages and the sitemap
immediately. Until something is published, the blog shows an honest
"first articles are being written" state, like Projects.

Setup: run the **V6 — Blog** block of [supabase/schema.sql](supabase/schema.sql).
It also inserts two starter posts (EN + FA) as **drafts** for you to edit and
publish.

The CRM uses it too: **Suggest content** on a lead picks the published post
most relevant to that lead's challenge and drafts a short follow-up to copy;
for a converted lead it's also noted on the contact's timeline.

### Adding photos

Drop images in `public/` and replace the placeholder frame in
[components/sections/AboutTeaser.tsx](components/sections/AboutTeaser.tsx) with
`next/image`. Guide rules: natural window light, real desk, green accent —
never stock photography.

---

## How it is built

```
app/[locale]/          pages — layout sets <html lang dir>
  page.tsx             homepage: Hero → Proof → Services → Projects → About → Contact
  about/page.tsx       full bio
  [...rest]/page.tsx   catch-all so bad URLs 404 in the right language
app/api/contact/       form endpoint: Zod validation → Supabase
app/admin/             internal dashboard (leads, registrations, conversations) — outside [locale]
app/(documents)/       client-facing proposal & contract pages — outside [locale]
components/sections/   one file per homepage section
components/layout/     Header, Footer, LocaleSwitch
components/ui/         Button, Section, Logo
components/admin/      admin panel UI (nav, tables, login form)
i18n/                  routing, navigation helpers, request config
messages/              en.json, fa.json — all visible copy
content/projects.ts    portfolio data
supabase/schema.sql    database, run once
```

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · next-intl ·
Supabase · deployed on Vercel.

### Two rules worth keeping

1. **Import `Link` from `@/i18n/navigation`, never from `next/link`.** The plain
   one drops the locale prefix and bounces Persian visitors back to English.
2. **Never put an entrance animation that fades opacity on text a visitor must
   read.** The hero headline uses `.rise-in-solid` (transform only) so that if
   the animation is frozen — background tab, throttling — the sentence is still
   there. `.rise-in` fades and is for decoration only.

### RTL

Persian gets `dir="rtl"` on `<html>` and the whole layout mirrors. This works
because the CSS uses **logical properties** (`padding-inline`, `margin-inline`,
`border-s`, `ps-*`) rather than left/right. If you add styling, keep to logical
properties or Persian will break.

---

## Not built yet (Phase 2)

Booking and payments were deliberately deferred — see
[the plan](../../.claude/plans/here-is-the-english-quirky-hearth.md).

Sign-up (Supabase Auth) → pay (Stripe Checkout, test mode first) → pick a slot
(Cal.com embed) → client dashboard. The agreed flow is **pay first, then
schedule**, with the payment record in Supabase so webinar sales later reuse it.
The table shapes are already written as comments at the bottom of
[supabase/schema.sql](supabase/schema.sql).
