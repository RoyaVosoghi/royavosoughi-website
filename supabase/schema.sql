-- =============================================================================
-- royavosoughi.com — database schema
-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- V1: contact form submissions
-- -----------------------------------------------------------------------------

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  email      text not null,
  company    text,
  message    text not null,
  locale     text not null default 'en',
  source     text not null default 'website'
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- The website may WRITE a message...
drop policy if exists "anon can insert contact messages"
  on public.contact_messages;
create policy "anon can insert contact messages"
  on public.contact_messages
  for insert
  to anon
  with check (true);

-- ...and that is all. There is deliberately NO select/update/delete policy,
-- so the public anon key cannot read, alter or erase a single message.
-- Read them in the Supabase dashboard (Table Editor), which uses your own
-- authenticated session and bypasses RLS.


-- =============================================================================
-- V2: chatbot brain (RAG + memory + tools) — service-role only.
-- Every table below is RLS-enabled with ZERO policies for anon/authenticated.
-- The brain runs entirely server-side (Next.js API routes) using the Supabase
-- service role key, which bypasses RLS unconditionally. Enabling RLS with no
-- policies is a deny-all safety net in case the anon/publishable key is ever
-- accidentally pointed at these tables later.
--
-- Data model v2 (2026-08-11) — documents/chunks, conversations/messages,
-- prompt_versions/model_config/embedding_config replaced the original
-- kb_chunks/chat_sessions/chat_messages/bot_settings shape. See
-- .agents/skills/chatbot-brain/SKILL.md for the full architecture writeup.
-- =============================================================================

create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- RAG knowledge base — documents (one row per source) + chunks (one row per
-- embedded slice of a document)
-- -----------------------------------------------------------------------------

-- `title` doubles as the stable dedupe key for idempotent re-ingestion
-- (e.g. 'site:copy', 'doc:pricing-faq') — `npm run ingest` deletes and
-- re-inserts a document's chunks by (title, locale). `locale` makes a
-- document's language explicit: the EN and FA versions of the same source
-- are two separate document rows, since retrieval always filters by locale.
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_type text not null check (source_type in ('site_copy', 'curated_doc', 'pdf', 'docx', 'url')),
  source_url  text,
  status      text not null default 'active' check (status in ('active', 'archived')),
  tags        text[] not null default '{}',
  locale      text not null default 'en' check (locale in ('en', 'fa')),
  created_at  timestamptz not null default now(),
  unique (title, locale)
);

create table if not exists public.chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content     text not null,
  embedding   vector(768) not null,   -- gemini-embedding-001, truncated to 768 dims
  token_count int,
  chunk_index int not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);

alter table public.documents enable row level security;
alter table public.chunks enable row level security;
-- No policies on either: service role only. RAG reads happen exclusively server-side.

-- supabase-js cannot express the `<=>` operator via the query builder, so
-- retrieval calls this function via .rpc(). Runs only under the service-role
-- connection, which already has full table access — no extra privilege
-- escalation from this function. search_path is pinned so it can't be
-- hijacked by a role-local setting.
create or replace function public.match_chunks(
  query_embedding vector(768),
  match_locale text,
  match_count int default 6
) returns table (
  id uuid, content text, metadata jsonb, document_id uuid, document_title text, similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.content, c.metadata, c.document_id, d.title,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where d.locale = match_locale and d.status = 'active'
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- -----------------------------------------------------------------------------
-- Memory: conversations + short-term message history + long-term facts
-- -----------------------------------------------------------------------------

-- channel is first-class from day one so telegram/widget are additive later,
-- never a schema change. external_user_id is whatever the channel calls "one
-- conversation" (web: client-generated UUID; telegram: chat_id; widget: its
-- own generated id). summary/summary_up_to_count back long-conversation
-- summarization (lib/ai/memory.ts): past a configurable message count, older
-- turns fold into `summary` instead of being sent verbatim.
create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  channel             text not null check (channel in ('web', 'telegram', 'widget')),
  external_user_id    text not null,
  status              text not null default 'active' check (status in ('active', 'closed')),
  summary             text,
  summary_up_to_count int not null default 0,
  -- Set by Telegram's /reset command — messages before this timestamp are
  -- excluded from what the brain sends the model as context (not deleted;
  -- the admin conversation viewer still shows everything).
  context_reset_at    timestamptz,
  locale              text not null default 'en',
  lead_email          text,   -- set once the lead-gen tool captures an email
  started_at          timestamptz not null default now(),
  last_active_at      timestamptz not null default now(),
  -- Set when status transitions to 'closed' — 'idle_timeout' is the widget's
  -- own client-side inactivity timer (ElevenLabs has no equivalent for text
  -- sessions, see components/chat/ElevenLabsVoiceWidget.tsx), 'user_closed'
  -- is an explicit close via the header button.
  ended_reason          text check (ended_reason in ('user_closed', 'idle_timeout')),
  satisfaction_rating   smallint check (satisfaction_rating between 1 and 5),
  satisfaction_rated_at timestamptz,
  unique (channel, external_user_id)
);

alter table public.conversations enable row level security;
-- No policies: service role only.

-- Short-term memory: full message history per conversation. model_used /
-- tokens_in / tokens_out / retrieved_chunk_ids are populated on assistant
-- replies only (from the Gemini response's usage metadata and the RAG
-- context actually used for that turn) — useful for the admin conversation
-- viewer and for cost/quality auditing later.
create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  role                text not null check (role in ('user', 'assistant', 'tool')),
  content             text not null,
  model_used          text,
  tokens_in           int,
  tokens_out          int,
  retrieved_chunk_ids uuid[],
  tool_name           text,
  tool_payload        jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;
-- No policies: service role only.

-- Cross-channel identity registry: one row per (channel, external_id), name
-- filled in once known (a captured lead's name, or a Telegram profile name).
-- Distinct from `leads` — this tracks "we've seen this identity", not
-- business interest.
create table if not exists public.unified_users (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null check (channel in ('web', 'telegram', 'widget')),
  external_id text not null,
  name        text,
  first_seen  timestamptz not null default now(),
  unique (channel, external_id)
);

alter table public.unified_users enable row level security;
-- No policies: service role only.

-- Long-term memory: durable facts, keyed by email (the only stable identity
-- we have — the site has no auth). Anonymous visitors get short-term memory
-- only; once the lead tool captures an email, facts persist across sessions.
create table if not exists public.memory_facts (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  fact              text not null,
  source_session_id uuid references public.conversations(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists memory_facts_email_idx on public.memory_facts (email);

alter table public.memory_facts enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Tools: lead generation, registration status, human handoff, feedback
-- -----------------------------------------------------------------------------

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  interest        text,
  conversation_id uuid references public.conversations(id) on delete set null,
  source          text,   -- the channel the lead came in through (web/telegram/widget)
  locale          text not null default 'en',
  created_at      timestamptz not null default now()
);

create index if not exists leads_email_idx on public.leads (email);

alter table public.leads enable row level security;
-- No policies: service role only.

-- No event catalog exists yet (webinars/classes are "coming soon" on the
-- site), so this is deliberately minimal: enough to record + look up a
-- registration by email.
create table if not exists public.registrations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  event_type text not null check (event_type in ('webinar', 'online_class')),
  status     text not null default 'pending'
               check (status in ('pending', 'confirmed', 'cancelled')),
  session_id uuid references public.conversations(id) on delete set null,
  locale     text not null default 'en',
  created_at timestamptz not null default now()
);

create index if not exists registrations_email_idx on public.registrations (email);

alter table public.registrations enable row level security;
-- No policies: service role only.

-- Human handoff: recorded by the request_human_handoff tool when a question
-- is out of scope or the visitor asks to talk to Roya directly.
create table if not exists public.handoff_requests (
  id         uuid primary key default gen_random_uuid(),
  reason     text not null check (reason in ('out_of_scope', 'user_requested', 'other')),
  note       text,
  session_id uuid references public.conversations(id) on delete set null,
  locale     text not null default 'en',
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists handoff_requests_created_at_idx
  on public.handoff_requests (created_at desc);

alter table public.handoff_requests enable row level security;
-- No policies: service role only.

-- Thumbs up/down on a specific assistant message, from the web/widget UI.
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  rating     smallint not null check (rating in (-1, 1)),
  comment    text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
-- No policies: service role only (written via app/api/feedback/route.ts using
-- the service client, even though the *caller* is an anonymous visitor).

-- Rate limiting for the chat API. A single-purpose hit log, dual-keyed
-- (session + IP independently) so clearing localStorage alone doesn't reset
-- the limit.
create table if not exists public.rate_limit_hits (
  id         bigint generated always as identity primary key,
  hit_key    text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_created_idx
  on public.rate_limit_hits (hit_key, created_at);

alter table public.rate_limit_hits enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Admin: users + audit log
-- -----------------------------------------------------------------------------

-- One row per admin. password_hash (added in V3, see below) makes this a
-- real per-admin login — ADMIN_PASSWORD is only a break-glass bootstrap for
-- the first 'owner' row, see lib/admin/auth.ts.
create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  role       text not null default 'owner' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- No policies: service role only.

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  action        text not null,   -- e.g. 'settings.prompt.update', 'handoff.resolve'
  target        text,            -- free-form: what the action touched (a row id, a channel, ...)
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Bot configuration: prompt_versions + model_config + embedding_config
-- -----------------------------------------------------------------------------

-- Versioned persona, one row per save from /admin/settings. `persona` is
-- reused as the locale key ('en'/'fa') — only one row per locale may have
-- is_active = true at a time (enforced below), so "the active prompt" is
-- always an unambiguous single lookup. If no row is active for a locale, the
-- brain falls back to DEFAULT_SYSTEM_PROMPT_EN/FA in lib/ai/prompt.ts.
create table if not exists public.prompt_versions (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  persona    text not null check (persona in ('en', 'fa')),
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.admin_users(id) on delete set null
);

create unique index if not exists prompt_versions_one_active_per_persona
  on public.prompt_versions (persona) where is_active;

alter table public.prompt_versions enable row level security;
-- No policies: service role only.

-- One row per channel. provider is fixed to 'gemini' for now (see
-- [[chatbot-architecture]] on why) — temperature/max_tokens/top_p are
-- actually applied to the Gemini call; fallback_provider/fallback_model/
-- schedule are stored but not yet evaluated at runtime (no automatic
-- fallback or time-based model switching is implemented).
create table if not exists public.model_config (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null check (channel in ('web', 'telegram', 'widget')),
  provider          text not null default 'gemini',
  active_model      text not null,
  temperature       real not null default 0.7,
  max_tokens        int not null default 1024,
  top_p             real not null default 0.95,
  fallback_provider text,
  fallback_model    text,
  schedule          jsonb,
  updated_at        timestamptz not null default now(),
  unique (channel)
);

alter table public.model_config enable row level security;
-- No policies: service role only.

-- Singleton row (id fixed to 1). chunk_size/chunk_overlap/top_k/
-- similarity_threshold are the same knobs the old bot_settings row had —
-- top_k/similarity_threshold apply on every chat turn (lib/ai/retrieval.ts),
-- chunk_size/chunk_overlap apply on the next `npm run ingest`.
-- reranker_enabled/reranker_model are stored but NOT implemented — no
-- reranking step runs today; changing them has no effect yet.
create table if not exists public.embedding_config (
  id                   int primary key default 1 check (id = 1),
  provider             text not null default 'gemini',
  model                text not null,
  dimensions           int not null,
  chunk_size           int not null,
  chunk_overlap        int not null,
  top_k                int not null,
  similarity_threshold real not null,
  reranker_enabled     boolean not null default false,
  reranker_model       text,
  updated_at           timestamptz not null default now()
);

alter table public.embedding_config enable row level security;
-- No policies: service role only.

-- Singleton row (id fixed to 1) — embeddable widget appearance + domain
-- allowlist, editable from /admin/settings. Empty allowed_domains means
-- "allow every origin" (today's behavior); a non-empty list restricts
-- app/api/widget/* to those origins only.
create table if not exists public.widget_config (
  id                 int primary key default 1 check (id = 1),
  primary_color      text not null default '#0f7b4f',
  position           text not null default 'bottom-end' check (position in ('bottom-end', 'bottom-start')),
  welcome_message_en text,
  welcome_message_fa text,
  allowed_domains    text[] not null default '{}',
  updated_at         timestamptz not null default now()
);

alter table public.widget_config enable row level security;
-- No policies: service role for writes (admin panel). Reads happen via
-- app/api/widget/config/route.ts, a public GET endpoint that deliberately
-- re-exposes this row's non-secret fields to any origin.


-- =============================================================================
-- V3: full chatbot admin panel — multi-provider routing, real roles, RAG
-- management, human handoff, leads pipeline, channel config, security.
-- Same convention as V2: run manually in the Supabase SQL Editor. Additive
-- except the `chunks.embedding` widen below, which is a BREAKING change —
-- see the comment on that block before running it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Real per-admin auth + roles (replaces "one shared password, one seeded row")
-- -----------------------------------------------------------------------------

alter table public.admin_users
  add column if not exists password_hash text;

alter table public.admin_users
  drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('owner', 'editor', 'operator', 'viewer'));

-- -----------------------------------------------------------------------------
-- Embeddings: provider input_type (Cohere/Voyage distinguish query vs.
-- document embeddings) + widen the vector column to fit every provider in
-- the catalog.
--
-- Capped at 2000, not OpenAI text-embedding-3-large's native 3072 — pgvector
-- enforces a hard 2000-dimension ceiling on HNSW (and ivfflat) indexes, full
-- stop, regardless of Postgres/pgvector version. text-embedding-3-large's
-- `dimensions` API param (already used in lib/ai/providers/embeddings/openai.ts)
-- natively truncates below 3072 with minimal quality loss, so the embedding
-- catalog caps that model's selectable dimensions at 2000 to match.
--
-- BREAKING: existing rows in `chunks` were embedded at 768 dims (Gemini).
-- pgvector can't reinterpret a stored 768-dim vector as a zero-padded
-- 2000-dim one in place, so this block truncates `chunks` — re-run the
-- knowledge base ingest / use the admin "rebuild index" action immediately
-- after applying this migration. Every chunk is re-embedded into the new
-- 2000-wide column with the app-level zero-pad helper
-- (lib/ai/providers/embeddings/pad.ts), so cosine similarity is unaffected
-- once re-embedded — see plan doc for why zero-padding preserves cosine sim.
-- The HNSW index must be dropped before widening the column (an in-place
-- type change tries to rebuild the existing index against the new width
-- first, which fails the same 2000-dim check) and recreated after.
-- -----------------------------------------------------------------------------

alter table public.embedding_config
  add column if not exists input_type text;

-- lib/ai/embedding-catalog.ts uses provider id 'google' (the Gemini
-- Developer API client), not the old free-text 'gemini' the V2 default used.
update public.embedding_config set provider = 'google' where provider = 'gemini';
alter table public.embedding_config alter column provider set default 'google';
alter table public.model_config alter column provider set default 'openrouter';
update public.model_config set provider = 'openrouter';

truncate table public.chunks;

drop function if exists public.match_chunks(vector(768), text, int);
drop function if exists public.match_chunks(vector(3072), text, int);
drop index if exists public.chunks_embedding_idx;

alter table public.chunks
  alter column embedding type vector(2000);

create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.match_chunks(
  query_embedding vector(2000),
  match_locale text,
  match_count int default 6
) returns table (
  id uuid, content text, metadata jsonb, document_id uuid, document_title text, similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.content, c.metadata, c.document_id, d.title,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where d.locale = match_locale and d.status = 'active'
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- -----------------------------------------------------------------------------
-- Human handoff: pause the bot for a conversation while an operator is live;
-- flag a conversation for review (set manually or via negative feedback).
-- -----------------------------------------------------------------------------

alter table public.conversations
  add column if not exists bot_paused boolean not null default false;
alter table public.conversations
  add column if not exists flagged boolean not null default false;

-- -----------------------------------------------------------------------------
-- Leads pipeline
-- -----------------------------------------------------------------------------

alter table public.leads
  add column if not exists status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'converted', 'lost'));
alter table public.leads
  add column if not exists notes text;

-- -----------------------------------------------------------------------------
-- AI spend cap — a soft alert, not an enforced hard stop (no payment/metering
-- infra exists to guarantee a hard stop is even accurate).
-- -----------------------------------------------------------------------------

create table if not exists public.ai_budget_config (
  id                  int primary key default 1 check (id = 1),
  monthly_cap_usd     numeric(10, 2),
  alert_threshold_pct int not null default 80,
  updated_at          timestamptz not null default now()
);

insert into public.ai_budget_config (id) values (1) on conflict (id) do nothing;

alter table public.ai_budget_config enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Security/retention config — DB-editable mirror of what used to be
-- env-only (CHAT_RATE_LIMIT_*), plus a retention window for the
-- "run cleanup now" admin action.
-- -----------------------------------------------------------------------------

create table if not exists public.security_config (
  id                        int primary key default 1 check (id = 1),
  rate_limit_window_minutes int not null default 10,
  rate_limit_max_messages   int not null default 20,
  retention_days            int,
  updated_at                timestamptz not null default now()
);

insert into public.security_config (id) values (1) on conflict (id) do nothing;

alter table public.security_config enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Per-channel welcome message + quick replies (persona is per-locale;
-- greetings are per-channel-and-locale since Telegram/widget/web copy differs)
-- -----------------------------------------------------------------------------

create table if not exists public.channel_greetings (
  id            uuid primary key default gen_random_uuid(),
  channel       text not null check (channel in ('web', 'telegram', 'widget')),
  locale        text not null check (locale in ('en', 'fa')),
  welcome_message text,
  quick_replies text[] not null default '{}',
  updated_at    timestamptz not null default now(),
  unique (channel, locale)
);

alter table public.channel_greetings enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Channel secrets — today just Telegram (bot token + webhook secret), the one
-- credential the panel needs to actively USE (call setWebhook), not just
-- store. Same protection boundary as every other table here: service-role
-- key only, never exposed to the browser. Masked in the admin UI.
-- -----------------------------------------------------------------------------

create table if not exists public.channel_secrets (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  unique (channel, key)
);

alter table public.channel_secrets enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Chunking strategy — "paragraph" (default, groups whole paragraphs, best for
-- prose like site copy/brand docs) or "fixed" (hard character slices, better
-- for dense/unstructured source text with no real paragraph breaks).
-- -----------------------------------------------------------------------------

alter table public.embedding_config
  add column if not exists chunking_strategy text not null default 'paragraph'
    check (chunking_strategy in ('paragraph', 'fixed'));


-- =============================================================================
-- PHASE 2 — booking & payments. Not created yet; documented so the shape is
-- agreed before it gets built. Uncomment when the consultation goes live.
-- =============================================================================
--
-- profiles     — one row per signed-up user, linked to auth.users(id)
--                (id, full_name, company, timezone, created_at)
--
-- services     — the sellable offerings, so the price lives in ONE place
--                (id, slug, name_en, name_fa, duration_minutes,
--                 price_cents, currency, is_active)
--
-- bookings     — one row per purchased consultation
--                (id, user_id → profiles, service_id → services,
--                 status: 'pending_payment' | 'paid' | 'scheduled'
--                       | 'completed' | 'cancelled',
--                 starts_at, ends_at, meeting_url,
--                 cal_booking_uid, created_at)
--
-- payments     — Stripe record, kept separate so refunds are auditable
--                (id, booking_id → bookings, stripe_session_id,
--                 stripe_payment_intent, amount_cents, currency,
--                 status, created_at)
--
-- webinars     — the later offering; reuses services/payments unchanged
--                (id, slug, title_en, title_fa, starts_at, capacity,
--                 price_cents, recording_url)
--
-- RLS intent for all of the above: a user may select ONLY rows where
-- user_id = auth.uid(). Inserts happen server-side from the Stripe webhook
-- using the service-role key, never from the browser.
