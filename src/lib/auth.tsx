import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
    // Use secure edge function to look up email by username
    try {
      const { data, error: fnError } = await supabase.functions.invoke('auth-lookup', {
        body: { action: 'lookup_username', username: username.toLowerCase() },
      });

      if (fnError || !data?.email) {
        return { error: new Error('Invalid login credentials') };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
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
