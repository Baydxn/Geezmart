/**
 * Admin authentication & authorisation.
 *
 * Credentials are verified by Supabase Auth — the app never sees or stores a
 * password hash. After a successful sign-in the `profiles` row supplies the
 * role, which drives the permission checks below and the RLS policies in
 * `supabase/migrations/0006_rls_roles.sql`.
 *
 * The frontend keeps a defensive rate limiter and a session envelope so a
 * reload does not bounce the operator back to the login screen, but both are
 * convenience only: Postgres RLS is the real security boundary.
 */
import type { AdminRole, AdminUser } from '../types/admin';
import { ROLE_PERMISSIONS } from '../types/admin';
import { store } from '../lib/db';
import { isSupabaseConfigured, requireClient } from '../lib/dbRepository';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'geezmart.admin.session.v1';
const ATTEMPT_KEY = 'geezmart.admin.attempts.v1';

export interface AdminSession {
  token: string;
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  issuedAt: number;
  expiresAt: number;
}

/* --------------------------- rate limiting --------------------------- */

interface AttemptState {
  count: number;
  lockedUntil: number;
}

function readAttempts(email: string): AttemptState {
  try {
    const all = JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? '{}') as Record<string, AttemptState>;
    return all[email] ?? { count: 0, lockedUntil: 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function writeAttempts(email: string, state: AttemptState) {
  try {
    const all = JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? '{}') as Record<string, AttemptState>;
    all[email] = state;
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function lockoutRemaining(email: string): number {
  const state = readAttempts(email);
  return Math.max(0, state.lockedUntil - Date.now());
}

/* ------------------------------ session ------------------------------ */

function timeoutMinutes(): number {
  return store.read().settings.security.sessionTimeoutMinutes;
}

export function createSession(user: AdminUser, remember: boolean): AdminSession {
  const ttl = (remember ? timeoutMinutes() * 24 : timeoutMinutes()) * 60_000;
  const session: AdminSession = {
    token: crypto.randomUUID(),
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    issuedAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };
  writeSession(session, remember);
  return session;
}

function writeSession(session: AdminSession, remember: boolean) {
  try {
    const target = remember ? localStorage : sessionStorage;
    target.setItem(SESSION_KEY, JSON.stringify(session));
    (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function readSession(): AdminSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AdminSession;
    if (session.expiresAt < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/* ------------------------------- login ------------------------------- */

export type LoginResult =
  | { ok: true; session: AdminSession }
  | { ok: false; reason: 'invalid' | 'locked' | 'rate' };

function isStaffRole(role: string): role is AdminRole {
  return role !== 'customer';
}

/**
 * Signs an admin in against Supabase Auth.
 *
 * A valid password is not sufficient: the account must also carry a staff role
 * in `profiles`, otherwise an ordinary shopper could reach the control centre.
 */
export async function signIn(email: string, password: string, remember: boolean): Promise<LoginResult> {
  const normalised = email.trim().toLowerCase();
  const attempts = readAttempts(normalised);
  const remaining = lockoutRemaining(normalised);

  if (remaining > 0) return { ok: false, reason: 'locked' };
  if (attempts.count >= store.read().settings.security.loginMaxAttempts) {
    writeAttempts(normalised, { count: attempts.count, lockedUntil: Date.now() + 60_000 });
    return { ok: false, reason: 'rate' };
  }

  const recordFailure = () => {
    const count = attempts.count + 1;
    const max = store.read().settings.security.loginMaxAttempts;
    writeAttempts(normalised, {
      count,
      lockedUntil: count >= max ? Date.now() + 60_000 : 0,
    });
    return { ok: false, reason: 'invalid' } as const;
  };

  if (!isSupabaseConfigured) return recordFailure();

  const sb = supabase();
  if (!sb) return recordFailure();

  const { data, error } = await sb.auth.signInWithPassword({ email: normalised, password });
  if (error || !data.user) return recordFailure();

  // The role lives in `profiles`, which RLS restricts to the caller's own row.
  const { data: profile } = await requireClient()
    .from('profiles')
    .select('id, role, name, email, status')
    .eq('id', data.user.id)
    .maybeSingle();

  const row = (profile as { id?: string; role?: string; name?: string; email?: string; status?: string } | null) ?? null;
  if (!row || !row.id || !row.role || !isStaffRole(row.role)) {
    // Authenticated, but not staff — sign out immediately and treat as invalid.
    await sb.auth.signOut();
    return recordFailure();
  }

  if (row.status === 'suspended') {
    await sb.auth.signOut();
    return recordFailure();
  }

  const existing = store.read().admins.find((a) => a.id === row.id);
  const user: AdminUser = {
    ...(existing ?? {
      createdAt: new Date().toISOString(),
      lastLoginAt: '',
    }),
    id: row.id,
    name: row.name || data.user.email || normalised,
    email: row.email || data.user.email || normalised,
    role: row.role as AdminRole,
    avatarInitials: (row.name || normalised)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join(''),
  };

  writeAttempts(normalised, { count: 0, lockedUntil: 0 });

  const ttl = (remember ? timeoutMinutes() * 24 : timeoutMinutes()) * 60_000;
  const session: AdminSession = {
    token: data.session?.access_token ?? crypto.randomUUID(),
    userId: row.id,
    email: user.email,
    name: user.name,
    role: user.role,
    issuedAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };
  writeSession(session, remember);

  store.write('admins', (list) =>
    list.map((a) => (a.id === user.id ? { ...a, lastLoginAt: new Date().toISOString() } : a)),
  );

  return { ok: true, session };
}

/** Signs out of Supabase Auth and drops the local session envelope. */
export async function signOut(): Promise<void> {
  const sb = supabase();
  if (sb) await sb.auth.signOut();
  clearSession();
}

/* ---------------------------- permissions ---------------------------- */

export function can(role: AdminRole | undefined, permission: string): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes('*') || perms.includes(permission);
}

export function sessionExpiresIn(session: AdminSession | null): number {
  if (!session) return 0;
  return Math.max(0, session.expiresAt - Date.now());
}
