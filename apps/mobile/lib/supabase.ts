import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// True only when both env vars are real (not the .env example placeholders).
// When false, callers short-circuit to mock data instead of hanging ~10s on a DNS/TCP timeout.
export const supabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project') &&
  supabaseAnonKey.length > 0 &&
  !supabaseAnonKey.includes('your-anon-key');

if (__DEV__ && !supabaseConfigured) {
  console.warn(
    '[supabase] MOCK MODE — missing or placeholder credentials in apps/mobile/.env. ' +
      'Run `npm run supabase:check` to diagnose.',
  );
} else if (__DEV__) {
  console.log('[supabase] configured');
}

// Keep imports and local auth reads usable without configuration. Any request
// fails locally; placeholder credentials must never cause a network request.
export const supabase = createClient(
  supabaseConfigured ? supabaseUrl : 'https://supabase.invalid',
  supabaseConfigured ? supabaseAnonKey : 'unconfigured',
  {
    global: supabaseConfigured ? undefined : {
      // Answer with a 400 instead of throwing: the query client retries thrown
      // network errors with backoff, which would make a local failure hang for seconds.
      fetch: async () =>
        new Response(
          JSON.stringify({
            message: 'Supabase is not configured. Sign-in and syncing are unavailable.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    },
    auth: {
      storage: supabaseConfigured ? AsyncStorage : undefined,
      autoRefreshToken: supabaseConfigured,
      persistSession: supabaseConfigured,
      detectSessionInUrl: false,
    },
  },
);
