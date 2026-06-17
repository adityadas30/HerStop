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

if (!supabaseConfigured) {
  console.warn(
    '[supabase] Missing or placeholder credentials in apps/mobile/.env — using mock data.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
