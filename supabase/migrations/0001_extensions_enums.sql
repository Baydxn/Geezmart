-- =============================================================================
-- GEEZMART — 0001 extensions, helper functions and enumerations
-- Run order: 0001 -> 0002 -> 0003 -> 0004 -> 0005 -> 0006 -> 0007 -> 0008
-- =============================================================================

create extension if not exists "pgcrypto";     -- gen_random_uuid()
create extension if not exists "pg_trgm";      -- fuzzy product/customer search
create extension if not exists "btree_gist";   -- exclusion constraints (sale windows)

-- ---------------------------------------------------------------------------
-- Money / shared domain types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum (
    'super_admin','admin','product_manager','order_manager','support'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('active','suspended','deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum (
    'draft','published','hidden','out_of_stock','coming_soon'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending','confirmed','processing','shipped','out_for_delivery',
    'delivered','cancelled','refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'unpaid','pending','paid','failed','refunded','partially_refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method_kind as enum (
    'card','bank_transfer','ussd','cash_on_delivery','wallet'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_kind as enum ('percentage','fixed_amount','free_delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfilment_method as enum ('home_delivery','pickup');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('pending','approved','hidden','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.abandoned_stage as enum (
    'cart','checkout_step_1','checkout_step_2','checkout_step_3','payment_pending'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum (
    'product','banner','category','page','avatar','social','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.log_severity as enum ('info','warning','critical');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

-- Keep updated_at honest on every table that carries it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Generates human-facing order references: GZ-000001, GZ-000002, ...
-- Backed by a sequence (not count(*)+1) so concurrent checkouts can never
-- collide on or reuse a reference.
create sequence if not exists public.order_reference_seq start 1;

create or replace function public.next_order_reference()
returns text
language sql
as $$
  select 'GZ-' || lpad(nextval('public.order_reference_seq')::text, 6, '0');
$$;

-- Convenience view helper: is a product currently purchasable?
create or replace function public.is_sellable(p_status public.product_status)
returns boolean
language sql
immutable
as $$
  select p_status = 'published';
$$;
