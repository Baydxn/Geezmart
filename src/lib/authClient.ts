import { createClient } from './supabase';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshSession = useCallback(async () => {
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || '', name: '' });
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
    const { data: subscriber } = createClient().auth.onAuthStateChange(async () => {
      if (mounted) {
        await refreshSession();
      }
    });
    return () => {
      mounted = false;
      subscriber.unsubscribe();
    };
  }, [refreshSession]);

  const signIn = async (email: string, password: string) => {
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshSession();
  };

  const signUp = async (name: string, email: string, password: string) => {
    const sb = createClient();
    const { data, error } = await sb.auth.createUser({
      email,
      password,
    });
    if (error) throw error;
    if (data.user) {
      const role = 'customer';
      await sb.from('profiles').insert({
        id: data.user.id,
        name,
        email,
        role,
        status: 'active',
      });
      await refreshSession();
    }
  };

  const signOut = async () => {
    const sb = createClient();
    await sb.auth.signOut();
    setUser(null);
    navigate('/');
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
