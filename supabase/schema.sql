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
