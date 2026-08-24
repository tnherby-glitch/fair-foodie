-- MN Fair Foodie Finder — in-app account deletion (v6)
-- App Store Guideline 5.1.1(v): apps with account creation must offer account
-- deletion. A signed-in user calls this RPC to erase their account and data.
create or replace function delete_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  delete from reviews    where author = uid;
  delete from user_lists where owner  = uid;
  delete from profiles   where id     = uid;
  delete from auth.users where id     = uid;
end $$;

revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;
