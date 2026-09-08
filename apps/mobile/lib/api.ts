import { SymbolViewProps } from 'expo-symbols';

import { MOCK_STOPS, type StopData } from '@/data/mock-stops';
import { supabase, supabaseConfigured } from './supabase';
import type { Review, SavedStop, Stop } from './types';

// ---------------------------------------------------------------------------
// DB row → UI StopData mapper
// ---------------------------------------------------------------------------

function dbToStopData(row: Stop): StopData {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    distance: '', // computed client-side once location is available
    distanceMiles: 0,
    badge: row.badge,
    tags: row.tags.map((t) => ({
      label: t.label,
      icon: t.icon as SymbolViewProps['name'],
    })),
    imageColor: row.image_color,
    categories: row.categories,
    rating: row.rating,
    reviewCount: row.review_count,
  };
}

// ---------------------------------------------------------------------------
// Mock fallback mapper (unchanged from before)
// ---------------------------------------------------------------------------

function mockToStop(mock: (typeof MOCK_STOPS)[number]): Stop {
  return {
    id: mock.id,
    name: mock.name,
    address: mock.address,
    latitude: 0,
    longitude: 0,
    badge: mock.badge,
    categories: mock.categories,
    tags: mock.tags.map((t) => ({ label: t.label, icon: String(t.icon) })),
    image_url: null,
    image_color: mock.imageColor,
    rating: mock.rating,
    review_count: mock.reviewCount,
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch all stops. Queries Supabase; falls back to mock data on error/empty. */
export async function getStops(): Promise<StopData[]> {
  if (!supabaseConfigured) {
    if (__DEV__) console.log('[getStops] MOCK fallback (reason: supabase not configured)');
    return MOCK_STOPS;
  }
  try {
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .order('rating', { ascending: false });

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

/** Fetch reviews for a stop. */
export async function getReviews(_stopId: string): Promise<Review[]> {
  // Will query reviews table once DB is live
  return [];
}
