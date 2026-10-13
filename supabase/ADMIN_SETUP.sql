-- =============================================================================
-- GEEZMART — ADMIN SETUP (run this ONE file in the Supabase SQL Editor)
--
-- WHAT THIS DOES
--   1. Installs the `handle_new_user` trigger so every new sign-up gets a
--      `profiles` row automatically (migration 0008).
--   2. Promotes an EXISTING Supabase Auth user to a staff admin by email.
--
-- WHY YOU SEE "incorrect password"
--   The admin login first checks the password in Supabase Auth, THEN requires a
--   staff row in `public.profiles` (role must NOT be 'customer'). If that row is
--   missing, the app signs you out and reports failure — which looks like a wrong
--   password even when the password is correct. This script creates that row.
--
-- NO PASSWORD IS STORED HERE. The account must already exist in Supabase Auth
-- (Authentication -> Users). This script only links it to a staff profile.
--
-- Safe to run more than once (idempotent). Nothing is deleted or reset.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Auto-provision a profile for every new auth user (migration 0008)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, email, status)
  values (
    new.id,
    case
      when coalesce(new.raw_user_meta_data ->> 'role', 'customer')
           in ('super_admin','admin','product_manager','order_manager','support')
        then (new.raw_user_meta_data ->> 'role')::public.app_role
      else 'customer'::public.app_role
    end,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defensive: also let a signed-in user create their own profile row if the
-- trigger is ever absent. Never grants access to another user's row.
do $$ begin
  create policy "users insert own profile"
    on public.profiles for insert
    with check (id = auth.uid());
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 2. Promote YOUR account to Super Admin
--    Change the email below if needed. The auth user must already exist.
-- -----------------------------------------------------------------------------
do $$
declare
  v_email text := 'cc99187197@gmail.com';   -- <-- your Supabase Auth login email
  v_uid   uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);

  if v_uid is null then
    raise exception
      'No Supabase Auth user found for %. Create the user first in Authentication -> Users, then re-run this script.',
      v_email;
  end if;

  -- Create the profile row if missing, or upgrade an existing one to super_admin.
  insert into public.profiles (id, role, name, email, status)
  values (v_uid, 'super_admin', 'Admin', v_email, 'active')
  on conflict (id) do update
    set role = 'super_admin',
        status = 'active',
        email = excluded.email;

  raise notice 'Granted super_admin to % (uid=%).', v_email, v_uid;
end $$;


-- -----------------------------------------------------------------------------
-- 3. Verify — you should see one row with role = super_admin
-- -----------------------------------------------------------------------------
select p.id, p.email, p.role, p.status, p.name
from public.profiles p
join auth.users u on u.id = p.id
where p.role <> 'customer'
order by p.role;
