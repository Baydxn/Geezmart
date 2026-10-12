import { supabase } from './supabase';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Storefront (customer) authentication.
 *
 * Wraps Supabase Auth so shoppers can register, sign in, and stay signed in
 * across reloads. Identity always comes from a real Supabase session — there is
 * no mock/fallback user anywhere in this hook. When nobody is signed in `user`
 * is null and the UI shows the guest Sign In / Create Account options.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshSession = useCallback(async () => {
    const sb = supabase();
    if (!sb) {
      // Supabase not configured: nobody can be signed in.
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        // Pull the display name from the commerce profile when it exists so the
        // storefront never has to guess. Falls back to the email local part.
        let name = '';
        try {
          const { data: profile } = await sb
            .from('profiles')
            .select('name')
            .eq('id', session.user.id)
            .maybeSingle();
          name = (profile as { name?: string } | null)?.name ?? '';
        } catch {
          /* profile lookup is best-effort */
        }
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: name || (session.user.email || '').split('@')[0],
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await refreshSession();
    })();
    const sb = supabase();
    if (!sb) return;
    const { data: { subscription } } = sb.auth.onAuthStateChange(async () => {
      if (mounted) {
        await refreshSession();
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  const signIn = async (email: string, password: string) => {
    const sb = supabase();
    if (!sb) throw new Error('Authentication is not configured on this site.');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshSession();
  };

  const signUp = async (name: string, email: string, password: string) => {
    const sb = supabase();
    if (!sb) throw new Error('Authentication is not configured on this site.');
    // Supabase Auth's public sign-up method is `signUp`. The old code called a
    // non-existent `sb.auth.createUser`, which threw at runtime and blocked
    // every registration.
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    if (data.user) {
      const role = 'customer';
      // The profile row is normally created by the `handle_new_user` database
      // trigger; this upsert is a safe fallback for projects where that trigger
      // is absent. upsert (rather than insert) avoids a duplicate-key error when
      // the trigger already created the row.
      await sb.from('profiles').upsert(
        { id: data.user.id, name, email, role, status: 'active' },
        { onConflict: 'id' },
      );
      await refreshSession();
    }
  };

  const signOut = async () => {
    const sb = supabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    navigate('/');
  };

  /**
   * Sends a password-recovery email. Supabase redirects the link back to the
   * site; the visitor sets a new password from the emailed link.
   */
  const resetPassword = async (email: string) => {
    const sb = supabase();
    if (!sb) throw new Error('Authentication is not configured on this site.');
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };

  return { user, loading, signIn, signUp, signOut, resetPassword };
}
