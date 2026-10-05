/**
 * Supabase connection for GEEZMART.
 *
 * Used by BOTH the customer storefront and the admin control centre:
 *  - Admin auth (email/password sign-in, session persistence, RBAC)
 *  - Realtime orders + inventory feeds
 *  - Shared media/storage helpers
 *
 * The app degrades gracefully: when the environment variables are missing the
 * local control-plane database (src/lib/db.ts) keeps everything working, so a
 * fresh clone still runs before any backend is connected.
 *
 * Env vars (Vite exposes any prefix listed in vite.config.ts -> envPrefix):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let client: SupabaseClient | null = null;

/** Returns a Supabase client, or null when the project is not configured. */
export function supabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'geezmart.supabase.session',
      },
      global: {
        headers: { 'x-application-name': 'geezmart' },
      },
    });
  }
  return client;
}

export interface ConnectionReport {
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
  message: string;
  url: string;
  anonKeyPreview: string;
}

/**
 * Non-destructive connectivity probe used by the admin Settings screen.
 * It hits the REST auth settings endpoint with the publishable key only —
 * never a service-role key, never a write.
 */
export async function checkSupabaseConnection(): Promise<ConnectionReport> {
  const base: ConnectionReport = {
    configured: isSupabaseConfigured,
    reachable: false,
    latencyMs: null,
    message: isSupabaseConfigured
      ? 'Checking connection...'
      : 'Not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    url: SUPABASE_URL,
    anonKeyPreview: SUPABASE_PUBLISHABLE_KEY
      ? `${SUPABASE_PUBLISHABLE_KEY.slice(0, 10)}...${SUPABASE_PUBLISHABLE_KEY.slice(-4)}`
      : '',
  };

  if (!isSupabaseConfigured) return base;

  const started = performance.now();
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return { ...base, latencyMs, message: `Project responded with HTTP ${response.status}.` };
    }
    return { ...base, reachable: true, latencyMs, message: 'Connected to the GEEZMART Supabase project.' };
  } catch (error) {
    return {
      ...base,
      message: `Could not reach Supabase: ${error instanceof Error ? error.message : 'network error'}`,
    };
  }
}

/** Subscribe to realtime changes on a table (used for orders + inventory). */
export function subscribeToTable(
  table: string,
  onChange: () => void,
): (() => void) | null {
  const sb = supabase();
  if (!sb) return null;
  const channel = sb
    .channel(`geezmart:${table}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

/**
 * SQL bootstrap for the GEEZMART schema. Run once in the Supabase SQL editor;
 * RLS keeps customer data readable only to authenticated admins.
 */
export const SUPABASE_SCHEMA_SQL = `-- GEEZMART core schema
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  brand text not null default '',
  category_id text not null,
  subcategory_id text not null default '',
  blurb text not null default '',
  description text not null default '',
  price numeric(12,2) not null default 0,
  compare_at_price numeric(12,2),
  cost_price numeric(12,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  sale_start timestamptz,
  sale_end timestamptz,
  stock int not null default 0,
  reserved int not null default 0,
  low_stock_threshold int not null default 10,
  status text not null default 'draft',
  visual text not null default 'watch',
  images jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text not null,
  icon text not null default 'shop',
  tagline text not null default '',
  hidden boolean not null default false,
  sort_order int not null default 0,
  subcategories jsonb not null default '[]'::jsonb
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  customer_id uuid references auth.users(id),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  delivery numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null default 'card',
  payment_status text not null default 'pending',
  coupon_code text,
  status text not null default 'pending',
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  name text not null default '',
  phone text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  customer_id uuid references auth.users(id),
  rating int not null check (rating between 1 and 5),
  body text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  subheadline text not null default '',
  cta_text text not null default 'Shop Now',
  cta_href text not null default '/shop',
  status text not null default 'published',
  sort_order int not null default 0
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  admin_name text not null default '',
  action text not null,
  entity text not null,
  entity_id text not null default '',
  detail text not null default '',
  before_value text,
  after_value text,
  created_at timestamptz not null default now()
);

-- Row level security
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.orders enable row level security;

-- Public storefront read
create policy "products are publicly readable"
  on public.products for select using (status in ('published','out_of_stock'));
create policy "categories are publicly readable"
  on public.categories for select using (hidden = false);

-- Customers read only their own orders; admins read everything
create policy "customers read own orders"
  on public.orders for select
  using (auth.uid() = customer_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','admin','order_manager','support')
  ));
`;
