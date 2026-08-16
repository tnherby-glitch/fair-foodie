-- MN Fair Foodie Finder — launch hardening (v2)
-- Run AFTER schema.sql: Supabase → SQL Editor → New query → paste ALL → Run.
-- What this does:
--   1. Lists get an owner token: the first publisher of a slug owns it; only
--      the owner can update it. All writes go through one validated function.
--   2. Direct table writes from the public key are revoked.
--   3. Events get input validation + a per-list rate cap.
--   4. A hidden flag gives admins a takedown lever (hide in the dashboard).

-- 1) columns
alter table shared_lists add column if not exists owner_token uuid;
alter table shared_lists add column if not exists hidden boolean not null default false;

-- 2) single validated write path
create or replace function publish_list(
  p_slug text, p_title text, p_handle text, p_name text, p_food_ids jsonb, p_token uuid
) returns text
language plpgsql security definer set search_path = public as $$
declare existing shared_lists%rowtype;
begin
  if p_token is null then return 'bad_token'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$' then return 'bad_slug'; end if;
  if p_title is null or length(p_title) < 1 or length(p_title) > 80 then return 'bad_title'; end if;
  if p_food_ids is null or jsonb_typeof(p_food_ids) <> 'array'
     or jsonb_array_length(p_food_ids) < 1 or jsonb_array_length(p_food_ids) > 100 then
    return 'bad_foods';
  end if;

  select * into existing from shared_lists where slug = p_slug;
  if not found then
    insert into shared_lists (slug, title, creator_handle, creator_name, food_ids, owner_token)
    values (p_slug, p_title,
            left(coalesce(nullif(p_handle, ''), 'fairgoer'), 30),
            left(coalesce(nullif(p_name, ''), 'A fair foodie'), 40),
            p_food_ids, p_token);
    return 'created';
  elsif existing.owner_token = p_token then
    update shared_lists
       set title = p_title,
           creator_handle = left(coalesce(nullif(p_handle, ''), 'fairgoer'), 30),
           creator_name = left(coalesce(nullif(p_name, ''), 'A fair foodie'), 40),
           food_ids = p_food_ids,
           updated_at = now()
     where slug = p_slug;
    return 'updated';
  else
    return 'slug_taken';
  end if;
end $$;
grant execute on function publish_list(text, text, text, text, jsonb, uuid) to anon;

-- 3) close the open write policies; reads exclude hidden lists; token never leaks
drop policy if exists "anon publish lists" on shared_lists;
drop policy if exists "anon update lists" on shared_lists;
drop policy if exists "public read lists" on shared_lists;
create policy "public read visible lists" on shared_lists for select using (not hidden);
revoke insert, update, delete on shared_lists from anon;
-- hide the owner token from the public API entirely
revoke select on shared_lists from anon;
grant select (slug, title, creator_handle, creator_name, food_ids, created_at, updated_at) on shared_lists to anon;

-- 4) event validation + per-list rate cap (best-effort abuse brake)
create or replace function share_events_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if length(new.slug) > 80
     or length(coalesce(new.ref, '')) > 40
     or length(coalesce(new.channel, '')) > 20 then
    raise exception 'invalid event';
  end if;
  if (select count(*) from share_events
       where slug = new.slug and created_at > now() - interval '1 minute') > 120 then
    raise exception 'rate limited';
  end if;
  return new;
end $$;
drop trigger if exists share_events_guard on share_events;
create trigger share_events_guard before insert on share_events
  for each row execute function share_events_guard();

-- Takedown how-to: Table Editor → shared_lists → set hidden = true on the row.
