/**
 * Admin runtime context.
 *
 *  - `useAdminAuth` exposes the authenticated admin + permission checks.
 *  - `useDbVersion` re-renders any component when the shared database changes,
 *    which is what makes admin edits show up on the storefront instantly.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AdminUser, ActivityLog } from '../types/admin';
import { store, uid } from '../lib/db';
import { can, clearSession, readSession, signIn, type AdminSession, type LoginResult } from './auth';

interface AdminAuthValue {
  session: AdminSession | null;
  user: AdminUser | null;
  ready: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<LoginResult>;
  logout: () => void;
  can: (permission: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const result = await signIn(email, password, remember);
    if (result.ok) setSession(result.session);
    return result;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const user = useMemo(
    () => store.read().admins.find((a) => a.id === session?.userId) ?? null,
    [session],
  );

  const value = useMemo<AdminAuthValue>(
    () => ({
      session,
      user,
      ready,
      signIn: login,
      logout,
      can: (permission: string) => can(session?.role, permission),
    }),
    [session, user, ready, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}

/* ------------------------------ reactivity ------------------------------ */

const DbContext = createContext<number>(0);

export function DbProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = store.subscribe(() => setVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);
  return <DbContext.Provider value={version}>{children}</DbContext.Provider>;
}

/** Any component calling this re-renders whenever the database changes. */
export function useDbVersion(): number {
  return useContext(DbContext);
}

/* ---------------------------- activity logging ---------------------------- */

/** Record an admin action for the Activity Log. */
export function logActivity(
  entry: Omit<ActivityLog, 'id' | 'createdAt' | 'adminId' | 'adminName'>,
  adminName = 'System',
  adminId = 'sys',
) {
  store.write('activity', (list) => [
    {
      ...entry,
      id: uid('act'),
      adminId,
      adminName,
      createdAt: new Date().toISOString(),
    },
    ...list,
  ]);
}

export function notifyAdmin(
  notification: { kind: 'order' | 'stock' | 'customer' | 'review' | 'payment' | 'refund'; title: string; body: string; href: string },
) {
  store.write('notifications', (list) => [
    { ...notification, id: uid('ntf'), createdAt: new Date().toISOString(), read: false },
    ...list,
  ]);
}
