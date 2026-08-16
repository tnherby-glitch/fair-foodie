-- MN Fair Foodie Finder — real accounts (v3)
-- Run AFTER schema.sql and schema-v2-launch.sql.
-- Dashboard prerequisites (do these too):
--   Authentication → Providers → Email: ENABLED (on by default).
--   Authentication → URL Configuration →
--     Site URL: https://tnherby-glitch.github.io/fair-foodie/
--     Redirect URLs (add): https://tnherby-glitch.github.io/fair-foodie/**
--                          http://localhost:8899/**   (for local testing)

-- Public profile for each auth user.
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  handle     text unique,
  name       text not null default 'Fairgoer',
  avatar     text not null default '🙂',
  bio        text not null default 'Here for the food.',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "profiles are public"       on profiles for select using (true);
create policy "insert own profile"        on profiles for insert with check (auth.uid() = id);
create policy "update own profile"        on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a bare profile the moment a user signs up (name/handle/avatar
-- from the sign-up metadata when present; the app refines it right after).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, handle, avatar)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
    coalesce(nullif(new.raw_user_meta_data->>'handle',''),
             regexp_replace(lower(split_part(new.email,'@',1)), '[^a-z0-9]', '', 'g')),
    coalesce(nullif(new.raw_user_meta_data->>'avatar',''), '🙂')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();
