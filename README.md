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
components/sections/   one file per homepage section
components/layout/     Header, Footer, LocaleSwitch
components/ui/         Button, Section, Logo
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
