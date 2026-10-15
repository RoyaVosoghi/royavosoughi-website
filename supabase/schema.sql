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

-- -----------------------------------------------------------------------------
-- V1.1: two optional qualifying fields on the contact form (business stage,
-- best time to reach back) — lets a visitor add context without being
-- required to. Nullable, additive, safe to run on an existing table.
-- -----------------------------------------------------------------------------

alter table public.contact_messages
  add column if not exists business_stage text
    check (business_stage in ('idea', 'early', 'growing', 'established'));
alter table public.contact_messages
  add column if not exists preferred_time text
    check (preferred_time in ('morning', 'afternoon', 'evening'));

-- -----------------------------------------------------------------------------
-- V1.2: required qualifying questions on the consultation form (role,
-- industry, team size, need, current approach, timeline, budget). The API
-- enforces "required"; columns stay nullable so older rows remain valid.
-- Allowed values must match lib/contact-options.ts.
-- -----------------------------------------------------------------------------

alter table public.contact_messages
  add column if not exists role text
    check (role in ('founder', 'manager', 'technical', 'other')),
  add column if not exists industry text
    check (industry in ('retail', 'services', 'healthcare', 'education',
      'realEstate', 'hospitality', 'manufacturing', 'marketing', 'tech', 'other')),
  add column if not exists company_size text
    check (company_size in ('solo', 'small', 'medium', 'large', 'enterprise')),
  add column if not exists need_type text
    check (need_type in ('documents', 'support', 'automation', 'agent', 'unsure')),
  add column if not exists current_approach text
    check (current_approach in ('manual', 'tool', 'otherAi', 'none')),
  add column if not exists timeline text
    check (timeline in ('asap', 'quarter', 'half', 'exploring')),
  add column if not exists budget text
    check (budget in ('under2k', 'from2to5k', 'from5to15k', 'over15k', 'unsure'));


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

-- Chat guards (added later — idempotent for databases created before them).
-- injection_guard_enabled: answer obvious prompt-injection attempts with a
--   canned reply before any model call (see lib/ai/injection-guard.ts).
-- working_hours_*: outside these hours the bot still answers, but tells
--   visitors who want Roya herself that she'll reply on the next working day.
--   working_days uses JS getDay() numbering (0 = Sunday … 6 = Saturday).
alter table public.security_config add column if not exists injection_guard_enabled boolean not null default true;
alter table public.security_config add column if not exists working_hours_enabled   boolean not null default false;
alter table public.security_config add column if not exists working_hours_timezone  text    not null default 'UTC';
alter table public.security_config add column if not exists working_hours_start     smallint not null default 9  check (working_hours_start between 0 and 23);
alter table public.security_config add column if not exists working_hours_end       smallint not null default 18 check (working_hours_end between 1 and 24);
alter table public.security_config add column if not exists working_days            smallint[] not null default '{1,2,3,4,5}';

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
-- V4 — CRM module: classic Lead -> Convert -> Contact/Company/Deal flow, on
-- top of the existing leads table. Run this once in the Supabase dashboard
-- like every other block above.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pipeline stages — admin-editable config, not hardcoded, so the board's
-- columns can be renamed/reordered without a redeploy.
-- -----------------------------------------------------------------------------

create table if not exists public.pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 0,
  is_won     boolean not null default false,
  is_lost    boolean not null default false,
  color      text,
  created_at timestamptz not null default now()
);

create index if not exists pipeline_stages_sort_idx on public.pipeline_stages (sort_order);

insert into public.pipeline_stages (name, sort_order, is_won, is_lost) values
  ('New', 0, false, false),
  ('Contacted', 1, false, false),
  ('Proposal', 2, false, false),
  ('Negotiation', 3, false, false),
  ('Won', 4, true, false),
  ('Lost', 5, false, true)
on conflict (name) do nothing;

alter table public.pipeline_stages enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Companies — auto-created from a lead's company name at convert time, or
-- created/edited directly from the admin panel.
-- -----------------------------------------------------------------------------

create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  domain     text,
  industry   text,
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists companies_name_idx on public.companies (lower(name));

alter table public.companies enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Contacts — the real, editable CRM record. Distinct from `unified_users`
-- (which is just "we've seen this chat identity", see comment near that
-- table) — a contact is created deliberately, by converting a lead or by an
-- operator adding one directly.
-- -----------------------------------------------------------------------------

create table if not exists public.contacts (
  id                    uuid primary key default gen_random_uuid(),
  lead_id               uuid references public.leads(id) on delete set null,
  company_id            uuid references public.companies(id) on delete set null,
  name                  text not null,
  email                 text not null unique,
  phone                 text,
  title                 text,
  status                text not null default 'active'
                          check (status in ('active', 'customer', 'inactive')),
  source                text,
  locale                text not null default 'en',
  ai_summary            text,
  ai_summary_updated_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists contacts_company_idx on public.contacts (company_id);
create index if not exists contacts_lead_idx on public.contacts (lead_id);
create index if not exists contacts_email_idx on public.contacts (lower(email));

alter table public.contacts enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Deals — one Kanban card. `pipeline_stage_id` is ON DELETE RESTRICT
-- (deliberately, unlike most FKs here): a deal silently losing its stage
-- would vanish from every column, so the app must reassign a stage's deals
-- before that stage can be deleted.
-- -----------------------------------------------------------------------------

create table if not exists public.deals (
  id                        uuid primary key default gen_random_uuid(),
  contact_id                uuid not null references public.contacts(id) on delete cascade,
  company_id                uuid references public.companies(id) on delete set null,
  pipeline_stage_id         uuid not null references public.pipeline_stages(id) on delete restrict,
  title                     text not null,
  amount_cents              bigint not null default 0,
  currency                  text not null default 'USD',
  status                    text not null default 'open'
                              check (status in ('open', 'won', 'lost')),
  expected_close_date       date,
  closed_at                 timestamptz,
  ai_next_action            text,
  ai_next_action_updated_at timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists deals_stage_idx on public.deals (pipeline_stage_id);
create index if not exists deals_contact_idx on public.deals (contact_id);
create index if not exists deals_company_idx on public.deals (company_id);
create index if not exists deals_status_idx on public.deals (status);

alter table public.deals enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Activities — calls/meetings/notes/tasks against a contact (and optionally
-- a specific deal). Also doubles as the contact timeline's log of stage
-- changes (written as a 'note' row by updateContact, no separate history
-- table).
-- -----------------------------------------------------------------------------

create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  deal_id      uuid references public.deals(id) on delete cascade,
  type         text not null check (type in ('call', 'meeting', 'note', 'task')),
  subject      text not null,
  body         text,
  due_at       timestamptz,
  completed_at timestamptz,
  created_by   uuid references public.admin_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists activities_contact_idx on public.activities (contact_id);
create index if not exists activities_deal_idx on public.activities (deal_id);
create index if not exists activities_due_idx on public.activities (due_at)
  where completed_at is null;

alter table public.activities enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- AI usage log — lead scoring / contact summaries / deal next-action calls
-- don't go through the chat `messages` table, so without this they'd be
-- invisible to the budget dashboard. getMonthlySpend() sums both.
-- -----------------------------------------------------------------------------

create table if not exists public.ai_usage_log (
  id         uuid primary key default gen_random_uuid(),
  purpose    text not null check (purpose in ('lead_score', 'contact_summary', 'deal_next_action')),
  tokens_in  int,
  tokens_out int,
  cost_usd   numeric(10, 4),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_created_at_idx on public.ai_usage_log (created_at desc);

alter table public.ai_usage_log enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Leads: company name (captured manually at convert time — the capture_lead
-- chat tool is untouched in this pass) + AI 0-100 score.
-- -----------------------------------------------------------------------------

alter table public.leads add column if not exists company_name text;
alter table public.leads add column if not exists ai_score int
  check (ai_score is null or (ai_score between 0 and 100));
alter table public.leads add column if not exists ai_score_reason text;
alter table public.leads add column if not exists ai_score_updated_at timestamptz;

-- -----------------------------------------------------------------------------
-- Admin roles: add 'admin', ranked between 'editor' and 'owner'
-- (see lib/admin/auth.ts ROLE_RANK). Same drop/add-constraint pattern used
-- above when 'operator'/'viewer' were added.
-- -----------------------------------------------------------------------------

alter table public.admin_users
  drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('owner', 'admin', 'editor', 'operator', 'viewer'));

-- =============================================================================
-- V5 — CRM documents & outreach: proposals → contracts (public client pages,
-- online approval/acceptance, PDF by email) and AI-personalised email
-- campaigns. Run this block once in the Supabase SQL Editor, after V4.
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Proposals. `content` holds the editable sections (intro, understanding,
-- goals, phases, deliverables, options/packages, exclusions, …) as one JSON
-- document validated by lib/crm/proposal.ts — the shape evolves with the
-- templates, so it isn't spread over a dozen columns. Client fields are a
-- snapshot so a proposal can go to someone who isn't a CRM contact yet.
-- `view_token` is the unguessable public link (/proposal/<token>), minted
-- server-side with crypto.randomBytes.
-- -----------------------------------------------------------------------------

create table if not exists public.proposals (
  id               uuid primary key default gen_random_uuid(),
  proposal_no      text not null unique,
  locale           text not null default 'en' check (locale in ('en', 'fa')),
  contact_id       uuid references public.contacts(id) on delete set null,
  deal_id          uuid references public.deals(id) on delete set null,
  client_name      text not null,
  client_email     text not null,
  client_company   text,
  client_phone     text,
  title            text not null,
  content          jsonb not null default '{}'::jsonb,
  currency         text not null default 'EUR',
  valid_until      date,
  status           text not null default 'draft'
                     check (status in ('draft', 'sent', 'viewed', 'approved', 'changes_requested',
                                       'declined', 'converted', 'canceled')),
  view_token       text not null unique,
  revision         int not null default 0,
  sent_at          timestamptz,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  view_count       int not null default 0,
  responded_at     timestamptz,
  selected_option  text,
  responder_name   text,
  responder_ip     text,
  contract_id      uuid,
  created_by       uuid references public.admin_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists proposals_status_idx on public.proposals (status);
create index if not exists proposals_contact_idx on public.proposals (contact_id);
create index if not exists proposals_deal_idx on public.proposals (deal_id);

alter table public.proposals enable row level security;
-- No policies: service role only. The public page reads by token server-side.

create table if not exists public.proposal_comments (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  author      text not null check (author in ('client', 'admin')),
  body        text not null,
  revision    int not null default 0,
  created_by  uuid references public.admin_users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists proposal_comments_proposal_idx on public.proposal_comments (proposal_id, created_at);

alter table public.proposal_comments enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- Contracts. Body is Markdown (13-article template, lib/crm/contract-template.ts);
-- `## ` headings are auto-numbered as articles when rendered. Acceptance is
-- two-phase: accepted_* is stamped first (server time + IP), then the
-- browser renders the signed copy and accepted_copy_sent_at guards the
-- one-time email of that PDF.
-- -----------------------------------------------------------------------------

create table if not exists public.contracts (
  id                    uuid primary key default gen_random_uuid(),
  contract_no           text not null unique,
  locale                text not null default 'en' check (locale in ('en', 'fa')),
  title                 text not null,
  contact_id            uuid references public.contacts(id) on delete set null,
  deal_id               uuid references public.deals(id) on delete set null,
  company_id            uuid references public.companies(id) on delete set null,
  proposal_id           uuid references public.proposals(id) on delete set null,
  client_name           text not null,
  client_email          text not null,
  client_company        text,
  body_md               text not null default '',
  amount_cents          bigint not null default 0,
  currency              text not null default 'EUR',
  start_date            date,
  duration_label        text,
  status                text not null default 'draft'
                          check (status in ('draft', 'sent', 'viewed', 'accepted', 'canceled')),
  share_token           text not null unique,
  sent_at               timestamptz,
  viewed_at             timestamptz,
  accepted_at           timestamptz,
  accepted_by_name      text,
  accepted_ip           text,
  accepted_copy_sent_at timestamptz,
  created_by            uuid references public.admin_users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists contracts_status_idx on public.contracts (status);
create index if not exists contracts_contact_idx on public.contracts (contact_id);
create index if not exists contracts_deal_idx on public.contracts (deal_id);

alter table public.contracts enable row level security;
-- No policies: service role only.

-- proposals.contract_id → contracts, added after both tables exist.
alter table public.proposals drop constraint if exists proposals_contract_id_fkey;
alter table public.proposals
  add constraint proposals_contract_id_fkey
  foreign key (contract_id) references public.contracts(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Campaigns — human-in-the-loop personalised email. Recipients come from a
-- code-defined segment (lib/crm/segments.ts) and are frozen into
-- campaign_emails at creation; the AI drafts each one individually, and
-- nothing is sent until an admin has reviewed it.
-- -----------------------------------------------------------------------------

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  segment_key text not null,
  goal        text not null,
  status      text not null default 'draft' check (status in ('draft', 'sent')),
  created_by  uuid references public.admin_users(id) on delete set null,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.campaigns enable row level security;
-- No policies: service role only.

create table if not exists public.campaign_emails (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete set null,
  lead_id     uuid references public.leads(id) on delete set null,
  to_name     text not null,
  to_email    text not null,
  locale      text not null default 'en' check (locale in ('en', 'fa')),
  context     jsonb not null default '{}'::jsonb,
  subject     text,
  body_text   text,
  status      text not null default 'pending'
                check (status in ('pending', 'ready', 'skipped', 'sent', 'failed')),
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists campaign_emails_campaign_idx on public.campaign_emails (campaign_id);

alter table public.campaign_emails enable row level security;
-- No policies: service role only.

-- -----------------------------------------------------------------------------
-- AI usage log: new purposes for the V5 features (same drop/add-constraint
-- pattern as admin_users_role_check above).
-- -----------------------------------------------------------------------------

alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_purpose_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_purpose_check
  check (purpose in ('lead_score', 'contact_summary', 'deal_next_action',
                     'contract_rewrite', 'contract_followup', 'campaign_email', 'crm_assistant'));

-- =============================================================================
-- V6 — Blog. Bilingual posts (one row per language), written and published
-- from /admin/blog, shown at /<locale>/blog, and used by the CRM's
-- "Suggest content" button on leads. Run once after V5. Idempotent.
-- =============================================================================

create table if not exists public.blog_posts (
  id           uuid primary key default gen_random_uuid(),
  locale       text not null default 'en' check (locale in ('en', 'fa')),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null,
  excerpt      text not null default '',
  body_md      text not null default '',
  tags         text[] not null default '{}',
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by   uuid references public.admin_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (locale, slug)
);

create index if not exists blog_posts_published_idx on public.blog_posts (locale, published_at desc)
  where status = 'published';

alter table public.blog_posts enable row level security;
-- No policies: service role only. Public pages read published rows server-side.

-- Starter posts — DRAFTS. Nothing appears publicly until Roya reviews and
-- publishes them from /admin/blog.
insert into public.blog_posts (locale, slug, title, excerpt, tags, body_md) values
(
  'en',
  'pick-the-right-problem-before-you-build-ai',
  'Pick the right problem before you build anything with AI',
  'Most AI projects go wrong before a line of code is written — the wrong problem gets picked. Here is the short checklist I use with every client.',
  array['ai-strategy', 'getting-started'],
  $md$Most AI projects that disappoint don't fail in the code. They fail in the first meeting, when the wrong problem gets picked.

## Three questions before anything else

1. **Does this happen often?** A task your team does 200 times a week is worth automating. A task done twice a month usually isn't.
2. **Is the information already written down somewhere?** AI assistants are good at answering from your documents, emails and data. They can't invent knowledge your business doesn't have yet.
3. **What does "better" look like, in numbers?** Minutes saved per request, answers per day, errors caught. If we can't measure it, we can't tell whether it worked.

## A practical example

A team answering the same delivery-status questions all day is a strong candidate: high volume, the answer lives in one system, and the result is easy to measure.

"Use AI to grow sales" is not a problem yet. It's a wish. The work is turning it into one specific, repeated task.

## What to do next

Write down the three most repetitive tasks in your team this week. Bring them to a free 30-minute consultation and we'll find out together which one — if any — is worth building.$md$
),
(
  'fa',
  'pick-the-right-problem-before-you-build-ai',
  'پیش از ساختن هر ابزار هوش مصنوعی، مسئله‌ی درست را انتخاب کنید',
  'بیشتر پروژه‌های هوش مصنوعی پیش از نوشتن حتی یک خط کد شکست می‌خورند — چون مسئله‌ی اشتباه انتخاب می‌شود. این چک‌لیست کوتاهی است که با هر مشتری استفاده می‌کنم.',
  array['ai-strategy', 'getting-started'],
  $md$بیشتر پروژه‌های هوش مصنوعی که ناامیدکننده تمام می‌شوند، در کد شکست نمی‌خورند. در همان جلسه‌ی اول شکست می‌خورند؛ وقتی مسئله‌ی اشتباه انتخاب می‌شود.

## سه سؤال پیش از هر کاری

1. **آیا این کار زیاد تکرار می‌شود؟** کاری که تیم شما هفته‌ای ۲۰۰ بار انجام می‌دهد ارزش خودکارسازی دارد. کاری که ماهی دو بار انجام می‌شود معمولاً نه.
2. **آیا اطلاعاتش جایی نوشته شده است؟** دستیارهای هوش مصنوعی در پاسخ دادن از روی اسناد، ایمیل‌ها و داده‌های شما خوب‌اند. اما نمی‌توانند دانشی را بسازند که کسب‌وکار شما هنوز ندارد.
3. **«بهتر شدن» با عدد یعنی چه؟** دقیقه‌های صرفه‌جویی‌شده در هر درخواست، تعداد پاسخ در روز، خطاهای کمتر. اگر نتوانیم اندازه بگیریم، نمی‌فهمیم جواب داده یا نه.

## یک مثال کاربردی

تیمی که تمام روز به سؤال‌های تکراری درباره‌ی وضعیت سفارش جواب می‌دهد، گزینه‌ی خوبی است: حجم بالا، جواب در یک سیستم، و نتیجه‌ای که به‌راحتی اندازه‌گیری می‌شود.

«با هوش مصنوعی فروش را بیشتر کنیم» هنوز مسئله نیست؛ یک آرزوست. کار اصلی این است که آن را به یک کار مشخص و تکراری تبدیل کنیم.

## قدم بعدی

سه کار تکراری تیم‌تان را در همین هفته یادداشت کنید. آن‌ها را به یک جلسه‌ی مشاوره‌ی رایگان ۳۰ دقیقه‌ای بیاورید تا با هم ببینیم کدام‌یک — اگر اصلاً — ارزش ساختن دارد.$md$
)
on conflict (locale, slug) do nothing;

-- AI usage log: the CRM's blog-based content suggestion.
alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_purpose_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_purpose_check
  check (purpose in ('lead_score', 'contact_summary', 'deal_next_action',
                     'contract_rewrite', 'contract_followup', 'campaign_email', 'crm_assistant',
                     'content_suggestion'));

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
