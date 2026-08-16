-- MN Fair Foodie Finder — reviews aggregation + moderation (v5)
-- Run AFTER schema-v3-auth.sql. Real community ratings live here; the app reads
-- the food_scores view to replace the seeded baselines with live pup averages.

create table if not exists reviews (
  id            text primary key,
  food_id       text not null,
  author        uuid references auth.users on delete set null,
  author_name   text not null default 'A fair foodie',
  author_handle text not null default 'fairgoer',
  author_avatar text not null default '🙂',
  score         int  not null check (score between 1 and 5),
  body          text not null default '',
  photos        jsonb not null default '[]',
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists reviews_food_idx   on reviews (food_id) where not hidden;
create index if not exists reviews_author_idx on reviews (author);

alter table reviews enable row level security;

-- Anyone may read visible reviews; signed-in users may post/edit/delete their own.
create policy "public reads visible reviews" on reviews for select using (not hidden);
create policy "author inserts own review"    on reviews for insert
  with check (auth.uid() = author and char_length(body) <= 2000);
create policy "author updates own review"     on reviews for update using (auth.uid() = author) with check (auth.uid() = author);
create policy "author deletes own review"     on reviews for delete using (auth.uid() = author);

-- Light anti-spam: at most 20 reviews per author per 10 minutes.
create or replace function reviews_rate_guard() returns trigger
language plpgsql as $$
begin
  if (select count(*) from reviews
      where author = new.author and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'rate limit: too many reviews, slow down';
  end if;
  return new;
end $$;
drop trigger if exists reviews_rate_guard_t on reviews;
create trigger reviews_rate_guard_t before insert on reviews
  for each row execute function reviews_rate_guard();

-- Live pup aggregate. security_invoker so it respects the reviews SELECT policy
-- (only non-hidden rows are counted). Public-readable.
create or replace view food_scores with (security_invoker = on) as
  select food_id, count(*)::int as n, round(avg(score)::numeric, 3) as avg
  from reviews
  group by food_id;
grant select on food_scores to anon, authenticated;

-- ---------- moderation ----------
alter table profiles add column if not exists is_admin boolean not null default false;

-- Admins can see hidden reviews too (moderation queue).
create policy "admins read all reviews" on reviews for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Admins hide/unhide any review via a definer function (RLS can't be bypassed by clients).
create or replace function set_review_hidden(p_id text, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update reviews set hidden = p_hidden where id = p_id;
end $$;
revoke all on function set_review_hidden(text, boolean) from public;
grant execute on function set_review_hidden(text, boolean) to authenticated;

-- To make yourself an admin, run once with your own account signed in at least once:
--   update profiles set is_admin = true where handle = 'YOUR_HANDLE';
