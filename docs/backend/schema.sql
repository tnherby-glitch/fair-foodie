-- MN Fair Foodie Finder — sharing backend (Supabase)
-- Paste this whole file into Supabase: SQL Editor → New query → Run.

-- Shared lists: the canonical, cross-device copy of a shared list.
create table if not exists shared_lists (
  slug          text primary key,
  title         text not null,
  creator_handle text not null default 'fairgoer',
  creator_name  text not null default 'A fair foodie',
  food_ids      jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Share/visit events for attribution and creator stats.
create table if not exists share_events (
  id         bigint generated always as identity primary key,
  slug       text not null,
  event      text not null check (event in ('publish','visit','save','share')),
  ref        text,
  channel    text,
  created_at timestamptz not null default now()
);
create index if not exists share_events_slug_idx on share_events (slug, event);

-- Aggregated stats view (used by creator-facing share stats).
create or replace view share_stats as
  select slug,
         count(*) filter (where event = 'visit') as views,
         count(*) filter (where event = 'save')  as saves,
         count(*) filter (where event = 'share') as shares
  from share_events group by slug;

-- Row-level security: anyone can read; anon may insert/upsert (demo posture).
alter table shared_lists enable row level security;
alter table share_events enable row level security;

create policy "public read lists"   on shared_lists for select using (true);
create policy "anon publish lists"  on shared_lists for insert with check (true);
create policy "anon update lists"   on shared_lists for update using (true) with check (true);
create policy "public read events"  on share_events for select using (true);
create policy "anon insert events"  on share_events for insert with check (true);

grant select on share_stats to anon;

-- NOTE (production hardening, post-demo): tie updates to an owner token or
-- Supabase auth uid, rate-limit event inserts, and validate food_ids server-side.
