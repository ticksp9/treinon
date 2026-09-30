import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearCachedData } from '@/lib/offlineStorage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const lastUserId = useRef<string | null | undefined>(undefined);

  // A different person signed in on this device: drop everything cached in memory for the previous one
  useEffect(() => {
    const id = user?.id ?? null;
    if (lastUserId.current !== undefined && lastUserId.current !== id) queryClient.clear();
    lastUserId.current = id;
  }, [user?.id, queryClient]);

  // Older versions cached database responses in the service worker; remove that cache
  useEffect(() => {
    try { if ('caches' in window) void caches.delete('supabase-cache'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          username: username,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithUsername = async (username: string, password: string) => {
    // The server signs in with the username and returns only the session;
    // the user's email address never reaches the browser.
    try {
      const { data, error: fnError } = await supabase.functions.invoke('auth-lookup', {
        body: { action: 'sign_in', username: username.toLowerCase(), password },
      });

      if (fnError || !data?.access_token) {
        // Non-2xx responses carry the JSON body in fnError.context
        let code: string | undefined = data?.code;
        try {
          const ctx = (fnError as { context?: Response } | null)?.context;
          if (ctx && typeof ctx.json === 'function') code = (await ctx.json())?.code ?? code;
        } catch { /* ignore */ }
        if (code === 'email_not_confirmed') return { error: new Error('Email not confirmed') };
        if (code === 'rate_limited') return { error: new Error('Demasiadas tentativas. Aguarde alguns minutos.') };
        return { error: new Error('Invalid login credentials') };
      }

      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      return { error };
    } catch {
      return { error: new Error('Invalid login credentials') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Shared club tablets: do not leave the previous user's data on the device.
    // Pending (unsynced) operations are kept so no match data is lost.
    await clearCachedData();
    try {
      if ('caches' in window) await caches.delete('supabase-cache');
    } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithUsername, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
