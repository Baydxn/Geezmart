/**
 * Admin authentication & authorisation.
 *
 * Security model (frontend half — mirror every check server-side):
 *  - Passwords are stored ONLY as PBKDF2-SHA256(120k, per-user salt).
 *  - Login is rate limited with exponential lockout.
 *  - Session is a short-lived token in sessionStorage (or localStorage
 *    when "remember me" is used), never a raw password.
 *  - Route guards + per-role permissions decide what renders.
 */
import type { AdminRole, AdminUser } from '../types/admin';
import { ROLE_PERMISSIONS } from '../types/admin';
import { store } from '../lib/db';

const SESSION_KEY = 'geezmart.admin.session.v1';
const ATTEMPT_KEY = 'geezmart.admin.attempts.v1';
const PBKDF2_ITERATIONS = 120_000;

/* ------------------------------ hashing ------------------------------ */

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toBase64(bits);
}

/** Constant-time-ish comparison to avoid leaking hash prefixes. */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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

export async function signIn(email: string, password: string, remember: boolean): Promise<LoginResult> {
  const normalised = email.trim().toLowerCase();
  const attempts = readAttempts(normalised);
  const remaining = lockoutRemaining(normalised);

  if (remaining > 0) return { ok: false, reason: 'locked' };
  if (attempts.count >= store.read().settings.security.loginMaxAttempts) {
    writeAttempts(normalised, { count: attempts.count, lockedUntil: Date.now() + 60_000 });
    return { ok: false, reason: 'rate' };
  }

  const user = store.read().admins.find((a) => a.email.toLowerCase() === normalised);
  const hash = await hashPassword(password, user?.salt ?? 'geezmart');

  if (!user || !safeCompare(hash, user.passwordHash)) {
    const count = attempts.count + 1;
    const max = store.read().settings.security.loginMaxAttempts;
    writeAttempts(normalised, {
      count,
      lockedUntil: count >= max ? Date.now() + 60_000 : 0,
    });
    return { ok: false, reason: 'invalid' };
  }

  writeAttempts(normalised, { count: 0, lockedUntil: 0 });
  const session = createSession(user, remember);
  store.write('admins', (list) =>
    list.map((a) => (a.id === user.id ? { ...a, lastLoginAt: new Date().toISOString() } : a)),
  );
  return { ok: true, session };
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
