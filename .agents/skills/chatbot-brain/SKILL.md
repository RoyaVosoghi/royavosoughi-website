---
name: chatbot-brain
description: Reference for this repo's custom AI chatbot ("the brain") and its three surfaces — the /chat web page, the Telegram bot, and the embeddable widget for third-party sites — plus the full admin panel that manages it. Covers lib/ai/ architecture (multi-provider chat via OpenRouter, multi-provider embeddings, RAG), the Supabase schema, the ingest pipeline, real per-admin auth/roles, and deploy gotchas (webhook re-registration, widget rebuild, env vars). Load this before editing anything under lib/ai/, lib/admin/, app/api/chat, app/api/widget, app/api/telegram, app/api/admin, app/admin/, lib/widget/, scripts/ingest.ts, scripts/telegram-set-webhook.ts, or supabase/schema.sql — or when debugging why the bot isn't responding, RAG context looks wrong, or a deploy broke Telegram/the widget.
---

# Chatbot Brain

One brain, three channels, one admin panel. All chat logic funnels through a single entry point; the web page, Telegram bot, and embeddable widget are thin adapters around it. Chat generation runs through OpenRouter (multi-provider — Anthropic/Google/OpenAI/Qwen, all reachable as OpenAI-compatible tool-calling requests); embeddings run through one of four independently-configurable providers (Google/OpenAI/Cohere/Voyage). Supabase is the RAG + memory + admin store.

## Architecture — `lib/ai/`

- **`brain.ts`** — `runBrainTurn(input)`, the single entry point every channel calls. Flow: config check (`isOpenRouterConfigured()` + Supabase) → rate limit (`security_config`-backed) → get/create `conversations` row → upsert `unified_users` → append user message → **if `conversation.bot_paused`, stop here** (a human operator has taken over — see the handoff section below) → load that channel's `model_config`, resolve today's scheduled model override (`resolveScheduledModel`) → parallel `retrieveContext` + `getConversationContext` + `getLongTermFacts` + `getActivePromptContent` → `buildSystemInstruction` → OpenRouter `chat.completions.create` loop (OpenAI tool-call format, max 3 iterations, one automatic retry against `model_config.fallback_model` on any error via `generateWithFallback`) dispatching function calls → persist tool calls + final reply with `model_used`/`tokens_in`/`tokens_out`/`retrieved_chunk_ids`. Returns `{ reply, sessionId, messageId, sources, paused? }`.
- **`providers/openrouter.ts`** — the one client every chat model goes through (`openai` SDK pointed at `https://openrouter.ai/api/v1`). `isRateLimitError(err)` treats a 429 from OpenRouter the same way the old Gemini-only code treated Gemini's.
- **`model-catalog.ts`** — the fixed list of chat models offered in the admin picker (`MODEL_CATALOG`), grouped by provider, each with an OpenRouter slug and rough per-1M-token pricing used only for the dashboard's cost estimate — not live pricing.
- **`model-config.ts`** — `getModelConfig(channel)` / `updateModelConfig(channel, update)` / `getAllModelConfigs()`, backed by one `model_config` row per channel. `provider` is always `'openrouter'`. `fallbackModel` and `schedule` (day-of-week → model slug override, `resolveScheduledModel(config, now)`) are both real and evaluated by `brain.ts` now — not stored-but-unused placeholders anymore.
- **`budget.ts`** — `getBudgetConfig()`/`updateBudgetConfig()` (singleton `ai_budget_config`, id=1) and `getMonthlySpend()` (sums `messages.tokens_in/out` for the current calendar month, priced via `model-catalog.ts`). Surfaced on the Overview dashboard and `/admin/security` as a soft alert — nothing blocks a chat turn on budget.
- **`providers/embeddings/`** — one file per provider (`google.ts`, `openai.ts`, `cohere.ts`, `voyage.ts`), each exporting `embed(text, options)`; `index.ts` dispatches on `embedding_config.provider` and zero-pads every result up to `chunks.embedding`'s fixed `vector(2000)` width (`pad.ts` — 2000, not OpenAI text-embedding-3-large's native 3072, because pgvector's HNSW index has a hard 2000-dim ceiling; that model truncates via its own `dimensions` API param instead. Padding preserves cosine similarity, so this is safe as long as a document's chunks are never compared against a query embedded by a *different* model, which the "switching requires a full re-embed" UI flow enforces). `cohere.ts` also exports `rerankCohere()`, used by `retrieval.ts` when `embedding_config.reranker_enabled` is true and `COHERE_API_KEY` is set — independent of whichever provider is the active *embedding* model.
- **`embedding-catalog.ts`** — the four-provider, ~5-model catalog shown in the admin picker (`EMBEDDING_CATALOG`), each with native dimensions and whether it supports OpenAI-style custom `dimensions` truncation.
- **`gemini.ts`** — now embeddings-only (one of the four providers above). `GEMINI_EMBED_MODEL` (default `gemini-embedding-001`). No chat model constant lives here anymore — that moved to `model-catalog.ts`.
- **`embedding-config.ts`** — `getEmbeddingConfig()`/`updateEmbeddingConfig()`, singleton `embedding_config` row (id=1): `provider`/`model`/`dimensions`/`inputType` (all live-editable now, with an explicit "this requires a full re-embed" confirm step in the UI — not read-only anymore) plus `chunkSize`/`chunkOverlap`/`topK`/`similarityThreshold`/`rerankerEnabled`/`rerankerModel`.
- **`documents.ts`** — RAG document management: `getDocuments()`, `getDocumentWithChunks(id)`, `updateDocument(id, {status, tags})`, `deleteDocument(id)`, `reindexDocument(id)` (re-embeds one document's existing chunks with whatever `embedding_config` currently points at — doesn't re-chunk, since chunk content is unchanged).
- **`ingest.ts`** — `ingestSource` (core, now also stores `source_url`/`tags`) / `ingestSiteCopy` / `ingestCuratedDocs`, called by `scripts/ingest.ts`. Upserts a `documents` row keyed by `(title=sourceKey, locale)`, deletes+reinserts that document's `chunks`.
- **`ingest-sources.ts`** — `ingestPdf`/`ingestDocx`/`ingestUrl` adapters (pdf-parse, mammoth, cheerio) that extract text and funnel into `ingestSource()`. Used by `/admin/knowledge`'s upload form (`app/api/admin/documents/route.ts`), not by `scripts/ingest.ts`.
- **`retrieval.ts`** — `embedText(text, inputType)` dispatches through `providers/embeddings`; `retrieveContext(query, locale, override?)` embeds, calls `match_chunks`, optionally reranks (Cohere), filters by threshold. Overfetches (`k*3`) when reranking so there's a real candidate pool to reorder.
- **`memory.ts`** — conversation/message/fact persistence. `Conversation` now includes `botPaused` (read by `brain.ts` to skip generation). `getConversationContext` is the summarization gate (16-message threshold, last 8 kept verbatim, older folded via `summarize.ts`).
- **`summarize.ts`** — a plain (non-tool) OpenRouter call (fixed cheap model, `google/gemini-2.5-flash` — never whatever `model_config` has configured) that compresses old turns.
- **`prompt.ts`** — `buildSystemInstruction`. `DEFAULT_SYSTEM_PROMPT_EN/FA` are the hardcoded fallback personas.
- **`channel-greetings.ts`** — `getChannelGreeting(channel, locale)` / `getAllChannelGreetings()` / `updateChannelGreeting()`, backed by `channel_greetings` (unique on `channel,locale`). Welcome message + quick replies, DB-editable from `/admin/settings`. Widget's welcome message stays on `widget_config` (built earlier) — this table only adds quick replies for widget, and both welcome+quick-replies for web/Telegram.
- **`channel-secrets.ts`** — `getChannelSecret`/`setChannelSecret`/`maskSecret`, backed by `channel_secrets` (unique on `channel,key`). Today just Telegram's bot token + webhook secret, editable from `/admin/channels` — `lib/telegram.ts` resolves DB-first, env vars as fallback.
- **`playground.ts`** — `runPlaygroundTurn()`, a single-turn, never-persisted version of the brain's generation call (same retrieval/prompt-building, no memory, tool calls detected but never executed) — backs `/admin/playground`.
- **`tools/`** — `index.ts` exports both `toolDeclarations` (Gemini-shaped, still the single source of truth for name/description/schema) and `openAiToolDeclarations` (converted to OpenAI's `{type:"function", function:{...}}` shape for OpenRouter) plus `dispatchTool`. `lead.ts`, `registration.ts`, `handoff.ts` are unchanged.
- **`security-config.ts`** — `getSecurityConfig()`/`updateSecurityConfig()`/`runRetentionCleanup()`, singleton `security_config` row (id=1): rate-limit window/max (read by `rate-limit.ts`, env vars are now only the pre-row-existing fallback) and an optional retention window (days) for the "run cleanup now" action on `/admin/security`.
- **`chunk.ts`**, **`chat-schema.ts`**, **`feedback.ts`** (now also auto-flags the conversation on a 👎), **`widget-config.ts`**, **`types.ts`** (`BrainTurnOutput` gained an optional `paused` field) — unchanged in shape from before.

## Admin panel — `/admin`

Real per-admin login now (email + password against `admin_users.password_hash`, bcrypt) with four roles — `owner` (everything) > `editor` (persona/knowledge base/model/embedding config) > `operator` (inbox/handoffs/leads) > `viewer` (read-only) — enforced by `lib/admin/auth.ts`'s `requireRole(min)` in every mutating API route. `ADMIN_PASSWORD` is a break-glass bootstrap that only works for a seeded `owner` row that hasn't set `password_hash` yet; once that owner sets a real password from `/admin/team`, the shared secret stops being a live credential for their row. Session cookie signs `{adminUserId, expiresAt}` (`ADMIN_SESSION_COOKIE`).

Sidebar nav (`components/admin/AdminNav.tsx`), grouped:
- **Overview** — `/admin`: real analytics (`lib/admin/analytics.ts`) with a date-range picker, channel breakdown + token-cost-by-model charts (`recharts`), conversion rate, avg conversation length, satisfaction rate, and a "most-referenced topics" proxy (most-retrieved document titles).
- **Knowledge & AI** — `/admin/knowledge` (RAG document management: upload PDF/DOCX/URL/pasted text, list/archive/delete/re-index, test-search box), `/admin/settings` (persona versioning + model routing + embedding/retrieval config + channel greetings + widget appearance, all in one page, each section its own save button), `/admin/playground` (ad-hoc test chat, two-model compare, retrieved-chunk display — never writes to `conversations`/`messages`).
- **Inbox & people** — `/admin/conversations` (filterable by channel/status/search, shows `bot_paused`/`flagged` badges) → `/admin/conversations/[id]` (message thread with per-assistant-message "sources used" detail, pause/resume toggle, manual-reply box), `/admin/handoffs`, `/admin/leads` (status pipeline + notes + CSV export), `/admin/registrations`, `/admin/feedback` (ratings + auto-flagged conversations + unanswered-questions list with an "add to knowledge base" shortcut), `/admin/contacts` (cross-channel identity registry — was `/admin/users` before the `/admin/team` roles page took that name).
- **Channels** — `/admin/channels` (Telegram bot token + webhook secret, editable in-panel with a "save & register webhook" action that calls Telegram's `setWebhook` directly; widget embed-code generator), `/admin/broadcast` (Telegram mass-send, dry-run then explicit confirm — still the one feature that sends real messages to real people with no undo).
- **System** — `/admin/team` (owner-only: create/edit admins, assign roles, reset passwords), `/admin/audit-log`, `/admin/security` (owner-only: env-var key configured/missing checklist, DB-editable rate-limit/retention, "run cleanup now", AI spend cap + this month's estimated spend).

**Human handoff, concretely**: an operator toggles `conversations.bot_paused` from the conversation detail page (`PATCH /api/admin/conversations/[id]/pause`) — `brain.ts` then stores the visitor's message but returns `{paused: true}` without calling a model. The operator's manual replies (`POST /api/admin/conversations/[id]/reply`) are persisted as `role: 'assistant'` messages with `model_used: 'human-operator'`, and pushed to the visitor: Telegram gets a real `sendTelegramMessage` call (only channel with genuine push delivery); web (`ChatWidget.tsx`) and widget (`lib/widget/entry.ts`) instead poll `/api/chat/history` / `/api/widget/history` every 5s (capped at 5 minutes) while showing a "waiting for a person" state, since neither has a push channel into the browser.

## The three channels

| Channel | Entry point | Notes |
|---|---|---|
| Web | `app/[locale]/chat/page.tsx` / `app/[locale]/page.tsx` (homepage bubble) → `components/chat/ChatWidget.tsx` → POST `app/api/chat/route.ts` | Session id in `localStorage` key `rv_chat_session_id`. `runtime = "nodejs"`. Welcome message + starter pills come from `channel_greetings` (channel='web'), fetched server-side and passed as props — falls back to the i18n defaults in `messages/*.json` when unset. Handles a `paused` response by polling `/api/chat/history` (see handoff section above). |
| Telegram | `app/api/telegram/webhook/route.ts` | Validates `x-telegram-bot-api-secret-token` against the DB-first/env-fallback webhook secret (`lib/telegram.ts`). `/start`/`/help`/`/reset` never reach the LLM. Welcome message + quick-reply buttons come from `channel_greetings` (channel='telegram'); button taps use index-based callback data (`qr:<i>`) resolved against the same dynamic list, not a hardcoded three-item map anymore. |
| Widget | `app/api/widget/chat/route.ts` + `lib/widget/entry.ts` → bundled to `public/widget.js` | Vanilla JS, Shadow DOM. Fetches `GET /api/widget/config` on mount for appearance (`widget_config`) *and* quick replies (`channel_greetings`, channel='widget', both locales returned so the client picks by its own detected locale). Polls `/api/widget/history` while paused. |

All chat/webhook/feedback/history/config routes are forced `runtime = "nodejs"`.

## Supabase schema (`supabase/schema.sql` — apply manually in the SQL Editor)

V3 (append-only on top of the V2 shape, plus one breaking block) adds:
- `admin_users.password_hash` + widened role check (`owner|editor|operator|viewer`).
- `embedding_config.input_type`; provider default/normalization `'gemini'` → `'google'`.
- **Breaking**: `chunks.embedding` widened `vector(768)` → `vector(2000)` (capped there by pgvector's HNSW index limit, not by the catalog's largest model) to fit every embedding provider — the HNSW index is dropped and recreated as part of this migration, and `truncate table chunks` runs too, so re-ingest / re-upload knowledge base content afterward. `match_chunks` signature updated to match.
- `conversations.bot_paused`, `conversations.flagged`.
- `leads.status` (pipeline: new/contacted/qualified/converted/lost), `leads.notes`.
- New singletons: `ai_budget_config` (id=1), `security_config` (id=1).
- New `channel_greetings` (unique `channel,locale`), `channel_secrets` (unique `channel,key`).

Everything else (`documents`/`chunks`, `conversations`/`messages`, `unified_users`, `memory_facts`, `leads`/`registrations`/`handoff_requests`/`feedback`, `prompt_versions`/`model_config`/`embedding_config`/`widget_config`, `admin_users`/`audit_log`, `rate_limit_hits`) is the V2 shape, unchanged in structure. All tables: RLS enabled, zero policies — service-role key only.

## Ingest pipeline — [[chatbot-content-sync]]

`npm run ingest` (site copy + `content/knowledge/*.md`) is unchanged — still the only path for those two sources. PDF/DOCX/URL/pasted-text sources go through `/admin/knowledge`'s upload form instead, which calls the same `ingestSource()` core via `ingest-sources.ts`'s adapters.

Re-run `npm run ingest` (and redeploy) whenever site copy, `content/projects.ts`, or `content/knowledge/*.md` changes. Re-run "Rebuild index" from `/admin/settings` (or a document's own "Re-index" action) after switching embedding provider/model.

## Deploy checklist

- Env vars (see `.env.local.example`): Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `NEXT_PUBLIC_SITE_URL`, `OPENROUTER_API_KEY` (chat), one embedding provider key (`GEMINI_API_KEY` by default, or `OPENAI_API_KEY`/`COHERE_API_KEY`/`VOYAGE_API_KEY`), `TELEGRAM_BOT_TOKEN`+`TELEGRAM_WEBHOOK_SECRET` (bootstrap fallback only — `/admin/channels` is the real source of truth once set), `ADMIN_PASSWORD` (bootstrap only) + `ADMIN_SESSION_SECRET`.
- Site degrades gracefully with zero keys configured.
- `supabase/schema.sql` must be applied manually — apply the V3 block, note the `chunks` truncation, then re-ingest/re-upload.
- Seed one `admin_users` row (`role='owner'`, `password_hash=null`) before first login.
- After every deploy that changes the public URL: either re-run `npm run telegram:set-webhook -- <public-url>`, or use `/admin/channels`'s "Save & register webhook" action.
- `npm run build:widget` runs automatically via `prebuild`.

## package.json scripts

```
ingest                → tsx --conditions=react-server --env-file=.env.local scripts/ingest.ts
telegram:set-webhook  → tsx --env-file=.env.local scripts/telegram-set-webhook.ts -- <url>
build:widget          → esbuild lib/widget/entry.ts --bundle --minify --target=es2018 --format=iife --outfile=public/widget.js
prebuild               → npm run build:widget (auto-runs before `build`)
```
