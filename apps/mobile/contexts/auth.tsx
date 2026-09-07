import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as auth from '@/lib/auth';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True whenever there's no signed-in user — the default, guest-browsing state. */
  isGuest: boolean;
  /** True while the initial session restore (on app start) is still in flight. */
  loading: boolean;
  sendOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isGuest: true,
  loading: true,
  sendOtp: async () => ({ error: 'Auth not ready yet' }),
  verifyOtp: async () => ({ error: 'Auth not ready yet' }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from any session already stored on device, then keep in sync with
  // sign-in / sign-out / token-refresh events for as long as this provider is mounted.
  useEffect(() => {
    let isMounted = true;

    auth.getSession().then((restored) => {
      if (isMounted) {
        setSession(restored);
        setLoading(false);
      }
    });

    const unsubscribe = auth.onAuthStateChange((nextSession) => {
      if (isMounted) setSession(nextSession);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const sendOtp = useCallback((email: string) => auth.sendOtp(email), []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { session: newSession, error } = await auth.verifyOtp(email, token);
    if (newSession) setSession(newSession);
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isGuest: !session,
      loading,
      sendOtp,
      verifyOtp,
      signOut,
    }),
    [session, loading, sendOtp, verifyOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
