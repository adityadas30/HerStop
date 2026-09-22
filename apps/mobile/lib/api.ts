import { SymbolViewProps } from 'expo-symbols';

import { MOCK_STOPS, type StopData } from '@/data/mock-stops';
import { supabase, supabaseConfigured } from './supabase';
import type { ReportReason, Review, ReviewInput, ReviewStats, SavedStop, Stop } from './types';

// ---------------------------------------------------------------------------
// DB row → UI StopData mapper
// ---------------------------------------------------------------------------

function dbToStopData(row: Stop): StopData {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    tags: row.tags.map((t) => ({
      label: t.label,
      icon: t.icon as SymbolViewProps['name'],
    })),
    imageColor: row.image_color,
    categories: row.categories,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

// ---------------------------------------------------------------------------
// Public API — stops
// ---------------------------------------------------------------------------

/** Fetch all stops. Queries Supabase; falls back to mock data on error/empty. */
export async function getStops(): Promise<StopData[]> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log('[getStops] MOCK fallback (reason: supabase not configured)');
    return MOCK_STOPS;
  }
  try {
    const { data, error } = await supabase.from('stops').select('*').order('name');

    if (error) throw error;
    if (data && data.length > 0) {
      if (__DEV__) console.log(`[getStops] LIVE Supabase: ${data.length} rows`);
      return (data as Stop[]).map(dbToStopData);
    }
    if (__DEV__) console.log('[getStops] MOCK fallback (reason: live query returned 0 rows)');
  } catch (e) {
    if (__DEV__) console.warn('[getStops] MOCK fallback (reason: Supabase error)', e);
  }
  return MOCK_STOPS;
}

/** Fetch a single stop by id. */
export async function getStopById(id: string): Promise<StopData | null> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log(`[getStopById] MOCK fallback (reason: supabase not configured) id=${id}`);
    return MOCK_STOPS.find((s) => s.id === id) ?? null;
  }
  try {
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (data) {
      if (__DEV__) console.log(`[getStopById] LIVE Supabase: id=${id}`);
      return dbToStopData(data as Stop);
    }
  } catch (e) {
    if (__DEV__) console.warn(`[getStopById] MOCK fallback (reason: Supabase error) id=${id}`, e);
  }
  return MOCK_STOPS.find((s) => s.id === id) ?? null;
}

/**
 * Fetch the signed-in user's saved stops.
 *
 * Access is granted by RLS on `saved_stops` (`auth.uid() = user_id`), using the
 * session's JWT. The `userId` argument is only a query filter — it never acts as
 * the authorization, so a wrong value returns nothing rather than someone else's rows.
 *
 * Note there is no mock *data* fallback here: an empty list is a real answer
 * ("nothing saved yet"), so inventing saved stops would be wrong. On an error we
 * return an empty list and say so in the log.
 */
export async function getSavedStops(userId: string): Promise<SavedStop[]> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log('[getSavedStops] MOCK fallback (reason: supabase not configured)');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('saved_stops')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (__DEV__) console.log(`[getSavedStops] LIVE Supabase: ${data?.length ?? 0} rows`);
    return (data ?? []) as SavedStop[];
  } catch (e) {
    if (__DEV__) console.warn('[getSavedStops] empty fallback (reason: Supabase error)', e);
    return [];
  }
}

/**
 * Save or unsave a stop for the signed-in user.
 *
 * `nextSaved` is the state the UI has already optimistically switched to, so the
 * write is a plain upsert or delete. Both are idempotent, which is what makes a
 * double-tap harmless: the `unique (user_id, stop_id)` constraint is never violated.
 *
 * The user id comes from the stored session, never from the caller — the caller
 * cannot name a user it isn't.
 */
export async function toggleSaveStop(
  stopId: string,
  nextSaved: boolean,
): Promise<{ saved: boolean; error: string | null }> {
  if (!supabaseConfigured) {
    if (__DEV__) {
      console.log(`[toggleSaveStop] MOCK (reason: supabase not configured) id=${stopId}`);
    }
    return { saved: nextSaved, error: null };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    if (__DEV__) console.log(`[toggleSaveStop] skipped (reason: no session) id=${stopId}`);
    return { saved: !nextSaved, error: 'Sign in to keep your saved stops.' };
  }

  try {
    if (nextSaved) {
      const { error } = await supabase
        .from('saved_stops')
        .upsert(
          { user_id: userId, stop_id: stopId },
          { onConflict: 'user_id,stop_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('saved_stops')
        .delete()
        .eq('user_id', userId)
        .eq('stop_id', stopId);
      if (error) throw error;
    }

    if (__DEV__) {
      console.log(`[toggleSaveStop] LIVE Supabase: ${nextSaved ? 'saved' : 'unsaved'} id=${stopId}`);
    }
    return { saved: nextSaved, error: null };
  } catch (e) {
    if (__DEV__) console.warn(`[toggleSaveStop] write failed id=${stopId}`, e);
    return { saved: !nextSaved, error: 'Could not sync that change. Check your connection.' };
  }
}

// ---------------------------------------------------------------------------
// Public API — reviews
//
// Reads go through the security-definer RPCs from migration 003 (not yet
// applied to the live DB — calls below are expected to fail until a human
// runs it; that failure is surfaced as an ordinary error, never faked as
// Limited Data or an empty list). Writes stay a direct table upsert/delete,
// same pattern as `toggleSaveStop` above — the user id always comes from the
// session, never from a caller-supplied argument.
// ---------------------------------------------------------------------------

const GENERIC_LOAD_ERROR = "Couldn't load traveler feedback.";

/**
 * Fetch the (non-hidden, plus the caller's own) reviews for one stop via
 * `get_stop_reviews`. `error` is only ever non-null for a real failure (e.g.
 * the RPC doesn't exist yet) — an empty `reviews` array with `error: null`
 * always means "no reviews", including mock mode. Callers must not confuse
 * the two: an error must render as the error state, not as "No reviews yet".
 */
export async function getStopReviews(
  stopId: string,
): Promise<{ reviews: Review[]; error: string | null }> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log(`[getStopReviews] MOCK fallback (reason: supabase not configured) id=${stopId}`);
    return { reviews: [], error: null };
  }
  try {
    const { data, error } = await supabase.rpc('get_stop_reviews', { p_stop_id: stopId });
    if (error) throw error;
    if (__DEV__) console.log(`[getStopReviews] LIVE Supabase: ${data?.length ?? 0} rows id=${stopId}`);
    return { reviews: (data ?? []) as Review[], error: null };
  } catch (e) {
    if (__DEV__) console.warn(`[getStopReviews] RPC failed id=${stopId}`, e);
    return { reviews: [], error: GENERIC_LOAD_ERROR };
  }
}

/**
 * Fetch aggregate review stats for a list of stop ids in one call via
 * `get_stop_review_stats` — never call this once per stop. Stops with no
 * (non-hidden) reviews are simply absent from the returned map, same "empty
 * is not an error" rule as `getStopReviews`. Stats can lag a brand new review
 * by up to 24h server-side; that's expected, not an error.
 */
export async function getStopReviewStats(
  stopIds: string[],
): Promise<{ stats: Map<string, ReviewStats>; error: string | null }> {
  if (stopIds.length === 0) return { stats: new Map(), error: null };
  if (!supabaseConfigured) {
    if (__DEV__) console.log('[getStopReviewStats] MOCK fallback (reason: supabase not configured)');
    return { stats: new Map(), error: null };
  }
  try {
    const { data, error } = await supabase.rpc('get_stop_review_stats', { p_stop_ids: stopIds });
    if (error) throw error;
    const stats = new Map<string, ReviewStats>();
    for (const row of (data ?? []) as ReviewStats[]) stats.set(row.stop_id, row);
    if (__DEV__) console.log(`[getStopReviewStats] LIVE Supabase: ${stats.size} stop(s) with reviews`);
    return { stats, error: null };
  } catch (e) {
    if (__DEV__) console.warn('[getStopReviewStats] RPC failed', e);
    return { stats: new Map(), error: GENERIC_LOAD_ERROR };
  }
}

// Stop ids the current app session has written a review for. Purely in-memory
// (cleared on app restart) — used only to show "Visible to other travelers 24
// hours after posting" under a traveler's own fresh review, since the client
// has no exact timestamp (created_month is month-precision only) to work that
// out any other way. Never persisted, never sent anywhere.
const reviewedThisSession = new Set<string>();

/** Was a review written or edited for this stop during the current app session? */
export function wasReviewedThisSession(stopId: string): boolean {
  return reviewedThisSession.has(stopId);
}

/**
 * Create or update the signed-in user's one review for a stop.
 * `upsert` on `(user_id, stop_id)` — the existing author update policy allows
 * the update path once a row already exists.
 */
export async function upsertReview(
  stopId: string,
  input: ReviewInput,
): Promise<{ error: string | null }> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log(`[upsertReview] MOCK (reason: supabase not configured) id=${stopId}`);
    return { error: 'Reviews are not available in this preview yet.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return { error: 'Sign in to write a review.' };
  }

  try {
    const { error } = await supabase
      .from('reviews')
      .upsert({ ...input, user_id: userId, stop_id: stopId }, { onConflict: 'user_id,stop_id' });
    if (error) throw error;
    if (__DEV__) console.log(`[upsertReview] LIVE Supabase: saved id=${stopId}`);
    reviewedThisSession.add(stopId);
    return { error: null };
  } catch (e) {
    if (__DEV__) console.warn(`[upsertReview] write failed id=${stopId}`, e);
    return { error: 'Could not save your review. Check your connection and try again.' };
  }
}

/** Delete the signed-in user's own review for a stop. */
export async function deleteReview(stopId: string): Promise<{ error: string | null }> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log(`[deleteReview] MOCK (reason: supabase not configured) id=${stopId}`);
    return { error: 'Reviews are not available in this preview yet.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return { error: 'Sign in to manage your review.' };
  }

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('user_id', userId)
      .eq('stop_id', stopId);
    if (error) throw error;
    if (__DEV__) console.log(`[deleteReview] LIVE Supabase: deleted id=${stopId}`);
    return { error: null };
  } catch (e) {
    if (__DEV__) console.warn(`[deleteReview] delete failed id=${stopId}`, e);
    return { error: 'Could not delete your review. Check your connection and try again.' };
  }
}

/** Report another traveler's review via `report_review`. Idempotent server-side. */
export async function reportReview(
  reviewId: string,
  reason: ReportReason,
  note: string | null,
): Promise<{ error: string | null }> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log(`[reportReview] MOCK (reason: supabase not configured) reviewId=${reviewId}`);
    return { error: 'Reporting is not available in this preview yet.' };
  }
  try {
    const { error } = await supabase.rpc('report_review', {
      p_review_id: reviewId,
      p_reason: reason,
      p_note: note,
    });
    if (error) throw error;
    if (__DEV__) console.log(`[reportReview] LIVE Supabase: reported reviewId=${reviewId}`);
    return { error: null };
  } catch (e) {
    if (__DEV__) console.warn(`[reportReview] RPC failed reviewId=${reviewId}`, e);
    return { error: "Couldn't send your report. Check your connection and try again." };
  }
}

/**
 * Hide a single review for the caller only, via `hide_review`. Unlike a
 * global moderation hide, this only affects what the reporting traveler sees
 * going forward — it does not touch the review for anyone else.
 */
export async function hideReview(reviewId: string): Promise<{ error: string | null }> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log(`[hideReview] MOCK (reason: supabase not configured) reviewId=${reviewId}`);
    return { error: 'Hiding reviews is not available in this preview yet.' };
  }
  try {
    const { error } = await supabase.rpc('hide_review', { p_review_id: reviewId });
    if (error) throw error;
    if (__DEV__) console.log(`[hideReview] LIVE Supabase: hidden reviewId=${reviewId}`);
    return { error: null };
  } catch (e) {
    if (__DEV__) console.warn(`[hideReview] RPC failed reviewId=${reviewId}`, e);
    return { error: "Couldn't hide that review. Check your connection and try again." };
  }
}
