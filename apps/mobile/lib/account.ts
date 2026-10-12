import { supabase, supabaseConfigured } from './supabase';

// ---------------------------------------------------------------------------
// Account deletion — calls the `delete_my_account()` RPC from
// docs/migrations/007_delete_my_account.sql. The function deletes only the
// caller's own auth user; their profile, saved stops and reviews go with it.
// ---------------------------------------------------------------------------

/** PostgREST / Postgres signals for "this function isn't in the database". */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function/i.test(error.message ?? '')
  );
}

/**
 * Permanently delete the signed-in user's account, then drop the local session.
 * Never throws — returns a user-facing `error` string instead.
 */
export async function deleteMyAccount(): Promise<{ error: string | null }> {
  if (!supabaseConfigured) {
    return { error: 'Account deletion is not available in this preview yet.' };
  }

  try {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      if (__DEV__) console.warn('[deleteMyAccount] RPC failed:', error.code, error.message);
      if (isMissingFunction(error)) {
        return {
          error:
            'Account deletion is not available yet. Nothing was deleted. Please try again later or contact support.',
        };
      }
      return { error: "Couldn't delete your account. Nothing was deleted. Check your connection and try again." };
    }
  } catch (e) {
    if (__DEV__) console.warn('[deleteMyAccount] unexpected failure', e);
    return { error: "Couldn't delete your account. Nothing was deleted. Check your connection and try again." };
  }

  // The user no longer exists server-side, so a global sign-out would fail.
  // 'local' just clears the stored session on this device.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return { error: null };
}
