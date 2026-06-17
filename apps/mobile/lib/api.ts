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
  if (!supabaseConfigured) return MOCK_STOPS;
  try {
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .order('rating', { ascending: false });

    if (error) throw error;
    if (data && data.length > 0) return (data as Stop[]).map(dbToStopData);
  } catch (e) {
    console.warn('[getStops] Supabase failed, using mock data:', e);
  }
  return MOCK_STOPS;
}

/** Fetch a single stop by id. */
export async function getStopById(id: string): Promise<StopData | null> {
  if (!supabaseConfigured) return MOCK_STOPS.find((s) => s.id === id) ?? null;
  try {
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (data) return dbToStopData(data as Stop);
  } catch (e) {
    console.warn('[getStopById] Supabase failed, using mock data:', e);
  }
  return MOCK_STOPS.find((s) => s.id === id) ?? null;
}

/** Fetch saved stops for a user. */
export async function getSavedStops(_userId: string): Promise<SavedStop[]> {
  // Will query saved_stops table once auth is live
  return [];
}

/** Toggle a stop's saved state for the current user. */
export async function toggleSaveStop(_stopId: string): Promise<{ saved: boolean }> {
  // Will insert/delete from saved_stops table once auth is live
  return { saved: false };
}

/** Fetch reviews for a stop. */
export async function getReviews(_stopId: string): Promise<Review[]> {
  // Will query reviews table once DB is live
  return [];
}
