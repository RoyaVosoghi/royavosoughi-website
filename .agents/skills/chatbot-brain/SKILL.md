---
name: chatbot-brain
description: Reference for this repo's custom AI chatbot ("the brain") and its three surfaces — the /chat web page, the Telegram bot, and the embeddable widget for third-party sites. Covers lib/ai/ architecture, the Supabase RAG/memory schema, the ingest pipeline, and deploy gotchas (webhook re-registration, widget rebuild, env vars). Load this before editing anything under lib/ai/, app/api/chat, app/api/widget, app/api/telegram, lib/widget/, scripts/ingest.ts, scripts/telegram-set-webhook.ts, or supabase/schema.sql — or when debugging why the bot isn't responding, RAG context looks wrong, or a deploy broke Telegram/the widget.
---

# Chatbot Brain

One brain, three channels. All chat logic funnels through a single entry point; the web page, Telegram bot, and embeddable widget are thin adapters around it. Gemini is the LLM, Supabase is the RAG + memory store.

## Architecture — `lib/ai/`

- **`brain.ts`** — `runBrainTurn(input)`, the single entry point every channel calls. Flow: config check → rate limit → get/create session → append user message → load settings → parallel `retrieveContext` + `getConversationContext` (recent messages + summary) + `getLongTermFacts` → `buildSystemInstruction` (persona override + summary block) → Gemini `generateContent` loop (max 3 tool iterations) dispatching function calls → persist tool calls + final reply.
- **`gemini.ts`** — client setup. `GEMINI_CHAT_MODEL` (default `gemini-flash-latest`), `GEMINI_EMBED_MODEL` (default `gemini-embedding-001`), `EMBEDDING_DIMENSIONS = 768` (Matryoshka-truncated from native 3072 — **must match** `kb_chunks.embedding` column width if either ever changes).
- **`settings.ts`** — `getBotSettings()`/`updateBotSettings()`, backed by the singleton `bot_settings` row (id=1), 60s in-process cache invalidated on write. Every field has a hardcoded fallback in `DEFAULT_BOT_SETTINGS` — the brain behaves identically if the row or Supabase is missing. This is what `/admin/settings` edits.
- **`retrieval.ts`** — embeds the query, calls Supabase RPC `match_kb_chunks` with `top_k`/`similarity_threshold` from settings, filters results below the threshold. Fails soft (`[]` on error or nothing clears the bar) — RAG is an enhancement, never a hard dependency.
- **`memory.ts`** — session/message/fact persistence. `getOrCreateSession`, `appendMessage`, `getLongTermFacts`/`addLongTermFact` keyed by email, `linkSessionToEmail`. `getConversationContext(session, summarizeAfterMessages)` is the summarization gate: below the threshold, full history goes in verbatim; past it, only the last 8 messages (`RECENT_KEEP`) stay verbatim and everything older is folded into `chat_sessions.summary` (regenerated only when `summary_up_to_count` falls behind, not every turn) via `summarize.ts`.
- **`summarize.ts`** — `summarizeMessages()`, a plain (non-tool) Gemini call that compresses old turns into ≤5 sentences of English prose, folding forward any prior summary so nothing is lost across repeated compressions.
- **`prompt.ts`** — `buildSystemInstruction(locale, context, facts, {prompt, summary})`. `DEFAULT_SYSTEM_PROMPT_EN/FA` are the exported fallback personas (voice + explicit guardrails: stay in scope, no definitive professional advice, no guaranteed outcomes, hand off when stuck) — used whenever `settings.systemPromptEn/Fa` is NULL, i.e. no admin override saved.
- **`chunk.ts`** — paragraph-aware chunker, `chunkText(text, config)`. Config (target/max/overlap chars) comes from settings at ingest time, not hardcoded constants — `DEFAULT_CHUNK_CONFIG` mirrors `DEFAULT_BOT_SETTINGS` for standalone/test use.
- **`ingest.ts`** — `ingestSource`/`ingestSiteCopy`/`ingestCuratedDocs`, called by `scripts/ingest.ts`. Reads chunk config from `getBotSettings()` on each run, so an edit in `/admin/settings` takes effect on the next `npm run ingest` with no code change.
- **`tools/`** — `index.ts` (`toolDeclarations` + `dispatchTool`), `lead.ts` (`capture_lead` → inserts `leads`, links email), `registration.ts` (`check_registration_status` → queries `registrations`), `handoff.ts` (`request_human_handoff` → inserts `handoff_requests`; fired when a visitor asks for a person or the question is genuinely out of scope).
- **`types.ts`** — `Channel = "web"|"telegram"|"widget"`, `Locale = "en"|"fa"`.
- **`rate-limit.ts`** — dual-keyed (session + IP) against `rate_limit_hits`. Env: `CHAT_RATE_LIMIT_WINDOW_MINUTES` (default 10), `CHAT_RATE_LIMIT_MAX_MESSAGES` (default 20).
- **`chat-schema.ts`** — shared Zod `ChatRequestSchema` used by both HTTP routes; `getClientIp()`.

## Admin panel — `/admin`

Password-gated (`ADMIN_PASSWORD` + HMAC-signed `ADMIN_SESSION_SECRET` cookie, `lib/admin/auth.ts`), outside `app/[locale]/` since it's Roya's own English-only tool. Session cookie path is `/` (not `/admin`) — deliberately, so `app/api/admin/*` route handlers (settings, handoffs) get it too, not just `app/admin/*` pages. Pages: Overview (stat counts), Leads, Registrations, Conversations (+ per-session message viewer), Handoffs (resolve toggle), Settings (persona + RAG/chunking/summarization knobs, backed by `lib/ai/settings.ts`).

## The three channels

| Channel | Entry point | Notes |
|---|---|---|
| Web | `app/[locale]/chat/page.tsx` → `components/chat/ChatWidget.tsx` → POST `app/api/chat/route.ts` | Session id in `localStorage` key `rv_chat_session_id`. `runtime = "nodejs"`. Same-origin only, no CORS handling. |
| Telegram | `app/api/telegram/webhook/route.ts` | Validates `x-telegram-bot-api-secret-token` header against `TELEGRAM_WEBHOOK_SECRET`. Locale from `from.language_code`. `channelSessionId = chat_id`. Always acks HTTP 200. Replies via `lib/telegram.ts`. |
| Widget | `app/api/widget/chat/route.ts` + `lib/widget/entry.ts` → bundled to `public/widget.js` | CORS wide open (`Access-Control-Allow-Origin: *`) since it runs on third-party sites. Vanilla JS, no React/lib/ai imports — mounts in a Shadow DOM. Session id in `localStorage` key `rv_widget_session_id`. Self-detects API base from its own `<script src>` origin. |

All chat/webhook routes are forced `runtime = "nodejs"` (not edge) — the Supabase admin client + Gemini SDK are Node-based.

## Supabase schema (`supabase/schema.sql` — source of truth; apply manually in the SQL Editor or via the `mcp__supabase__apply_migration` tool if available, not an automated migration runner)

- **RAG**: `kb_chunks` (`source_type`: `site_copy`|`curated_doc`, `source_key`, `locale`, `chunk_index`, `content`, `embedding vector(768)`, `metadata jsonb`; unique on `source_key,locale,chunk_index`) + HNSW cosine index. RPC: `match_kb_chunks(query_embedding, match_locale, match_count)`.
- **Memory**: `chat_sessions` (unique on `channel,channel_session_id`; also `summary text` + `summary_up_to_count int` for long-conversation summarization), `chat_messages` (role: user/assistant/tool), `memory_facts` (by email).
- **Tools**: `leads`, `registrations`, `handoff_requests` (reason/note/resolved, written by the `request_human_handoff` tool).
- **Config**: `bot_settings` — singleton row (id=1), read/written by `lib/ai/settings.ts`, edited from `/admin/settings`.
- **Other**: `rate_limit_hits`; `contact_messages` (unrelated V1 contact-form table).
- All V2 tables: RLS enabled, zero policies — service-role key only, never exposed to the browser.
- A commented-out "Phase 2" section documents future `profiles`/`services`/`bookings`/`payments`/`webinars` tables — not yet created.

## Ingest pipeline — [[chatbot-content-sync]]

`npm run ingest` runs `scripts/ingest.ts` (`tsx --conditions=react-server --env-file=.env.local`). Two sources, both delete-then-reinsert per `source_key`+`locale` (idempotent):

1. **Site copy** — `messages/en.json` + `messages/fa.json` namespaces `about`/`aboutPage`/`services`, plus non-draft entries from `content/projects.ts`.
2. **Curated docs** — `content/knowledge/*.md`, filename pattern `<slug>.<locale>.md` → source key `doc:<slug>`. Currently empty aside from a README.

**`Roya_Brand_Guide.md` / `Roya_Brand_Guide_UPDATED.pdf` at the repo root are NOT ingested.** They're the human/design reference used to write site copy — not wired into RAG. If brand-guide content needs to be searchable by the bot, it has to be copied into `content/knowledge/*.md` first.

Re-run `npm run ingest` (and redeploy) whenever site copy, `content/projects.ts`, or `content/knowledge/*.md` changes.

## Deploy checklist

- Env vars (see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `GEMINI_API_KEY` (+ optional `GEMINI_CHAT_MODEL`/`GEMINI_EMBED_MODEL`), `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` (gates `/admin`), optional rate-limit overrides.
- Site degrades gracefully with zero keys configured — `/chat` shows "not available", contact form falls back to mailto. Don't treat missing keys as a build error.
- `supabase/schema.sql` must be applied manually once (Supabase SQL Editor) — it is not run automatically.
- **After every deploy that changes the public URL**, re-run `npm run telegram:set-webhook -- <public-url>` or the Telegram webhook keeps pointing at the old one.
- `npm run build:widget` (esbuild → `public/widget.js`) runs automatically via `prebuild` before `npm run build`. If bundling manually outside `npm run build`, don't forget it — a stale `public/widget.js` silently serves old widget code to every embedding site.
- Vercel: env vars under Project → Environment Variables; `NEXT_PUBLIC_SITE_URL` must be the production domain there.

## package.json scripts

```
ingest                → tsx --conditions=react-server --env-file=.env.local scripts/ingest.ts
telegram:set-webhook  → tsx --env-file=.env.local scripts/telegram-set-webhook.ts -- <url>
build:widget          → esbuild lib/widget/entry.ts --bundle --minify --target=es2018 --format=iife --outfile=public/widget.js
prebuild               → npm run build:widget (auto-runs before `build`)
```
