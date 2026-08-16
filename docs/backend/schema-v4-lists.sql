-- MN Fair Foodie Finder — personal list sync (v4)
-- Run AFTER schema-v3-auth.sql. A signed-in user's own lists live here so they
-- follow the account across devices. Public shares still go to shared_lists.

create table if not exists user_lists (
  id         text primary key,
  owner      uuid not null references auth.users on delete cascade,
  name       text not null,
  food_ids   jsonb not null default '[]',
  privacy    text not null default 'private',
  slug       text,
  ratings    jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_lists_owner_idx on user_lists (owner);

alter table user_lists enable row level security;

-- Owner has full control of their own lists.
create policy "owner reads own lists"   on user_lists for select using (auth.uid() = owner);
-- Anyone may read a list the owner marked public (future: browse others' public lists).
create policy "public reads public lists" on user_lists for select using (privacy = 'public');
create policy "owner inserts own lists"  on user_lists for insert with check (auth.uid() = owner);
create policy "owner updates own lists"  on user_lists for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "owner deletes own lists"  on user_lists for delete using (auth.uid() = owner);
