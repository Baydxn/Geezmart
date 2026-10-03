/**
 * Typed Supabase client factory.
 *
 * Single place where the publishable key is read. Never import a service-role
 * key here: anything in this bundle is visible to every visitor.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const SUPABASE_URL = import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let client: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'geezmart.supabase.session',
      },
      global: { headers: { 'x-application-name': 'geezmart' } },
      db: { schema: 'public' },
    });
  }
  return client;
}

/** Stable per-browser token so anonymous carts survive a refresh. */
export function cartSessionToken(): string {
  const KEY = 'geezmart.cart.token';
  let token = '';
  try {
    token = localStorage.getItem(KEY) ?? '';
    if (!token) {
      token =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, token);
    }
  } catch {
    /* private mode: fall back to a per-call token */
    token = `t_${Date.now().toString(36)}`;
  }
  return token;
}
