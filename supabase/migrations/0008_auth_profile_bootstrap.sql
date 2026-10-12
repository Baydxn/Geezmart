-- =============================================================================
-- GEEZMART — 0008 auth bootstrap: auto-provision a profile for every new user
--
-- WHY: `profiles` had SELECT + UPDATE RLS policies but no INSERT policy, so the
-- client-side `profiles.insert(...)` during registration was denied by RLS and
-- new shoppers ended up with an auth account but no commerce profile (no cart,
-- orders or account page).
--
-- The standard Supabase fix is a SECURITY DEFINER trigger on auth.users that
-- creates the profile server-side, bypassing RLS safely. The role is taken from
-- the sign-up metadata so staff created via the admin roster get their role,
-- while ordinary shoppers default to 'customer'.
--
-- Safe to re-run: uses CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- Run order: 0001 -> 0002 -> ... -> 0007 -> 0008
-- =============================================================================

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
    -- Trust the requested role ONLY if it is a known staff value; anything else
    -- (including a tampered customer) falls back to the least-privileged role.
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

-- Defensive fallback: if the trigger is ever missing (e.g. a project that only
-- applied an older schema), let a signed-in user still create their OWN profile
-- row. This never grants access to another user's row.
do $$ begin
  create policy "users insert own profile"
    on public.profiles for insert
    with check (id = auth.uid());
exception when duplicate_object then null; end $$;
