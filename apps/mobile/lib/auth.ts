import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Thin auth wrapper around the Supabase client.
// No service-role key, no new dependencies — just the existing `supabase`
// client from `lib/supabase.ts` (anon key only).
// ---------------------------------------------------------------------------

/** Send a 6-digit email OTP code. Creates the user on first sign-in. */
export async function sendOtp(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error && __DEV__) console.warn('[auth] sendOtp failed:', error.message);
  return { error: error?.message ?? null };
}

/** Verify the 6-digit code the user received by email. */
export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ session: Session | null; error: string | null }> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error && __DEV__) console.warn('[auth] verifyOtp failed:', error.message);
  return { session: data?.session ?? null, error: error?.message ?? null };
}

/** Sign the current user out. */
export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

/** Read the current session, if any (e.g. restored from AsyncStorage on app start). */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Subscribe to sign-in/sign-out/token-refresh events. Returns an unsubscribe function. */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (__DEV__) console.log('[auth] state change:', event);
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
