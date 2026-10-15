/**
 * Small pure helpers behind the Saved tab, kept out of the React files so they
 * can be unit-tested without rendering anything.
 */

/** A copy of `ids` with `id` saved or unsaved. Never mutates the original set. */
export function withSavedState(
  ids: ReadonlySet<string>,
  id: string,
  saved: boolean,
): Set<string> {
  const next = new Set(ids);
  if (saved) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * Whether a bookmark tap can save/unsave right now.
 *
 * Guests and signed-in users both can — guests keep the save in memory for
 * this session, signed-in users sync it. Being a guest is never a reason to
 * refuse. The only reason to wait is a restore in progress: while auth is
 * resolving or a saved list is loading, the restored list replaces the current
 * one, so a tap made now would silently disappear a moment later.
 */
export function canToggleSave(state: { authLoading: boolean; savedLoading: boolean }): boolean {
  return !state.authLoading && !state.savedLoading;
}

/**
 * Whether the Saved tab may say "No saved stops yet".
 *
 * A failed load is not an empty list: when there is a sync error we show the
 * error instead, so the screen never claims "nothing saved" while also
 * reporting that it could not check.
 */
export function shouldShowEmptySavedState(state: {
  hasStops: boolean;
  loading: boolean;
  showGuestCard: boolean;
  syncError: string | null;
}): boolean {
  if (state.hasStops || state.loading) return false;
  if (state.showGuestCard) return false; // the sign-in card already explains the empty list
  return state.syncError === null;
}
