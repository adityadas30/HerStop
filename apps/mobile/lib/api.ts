import { MOCK_STOPS } from '@/data/mock-stops';
import type { Review, SavedStop, Stop } from './types';

// ---------------------------------------------------------------------------
// Helpers — map current mock data to DB-shaped Stop type
// ---------------------------------------------------------------------------

function toStop(mock: (typeof MOCK_STOPS)[number]): Stop {
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
    rating: mock.rating,
    review_count: mock.reviewCount,
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API — returns mock data shaped as if it came from Supabase
// ---------------------------------------------------------------------------

/** Fetch all stops. Will query Supabase once connected. */
export async function getStops(): Promise<Stop[]> {
  return MOCK_STOPS.map(toStop);
}

/** Fetch a single stop by id. */
export async function getStopById(id: string): Promise<Stop | null> {
  const mock = MOCK_STOPS.find((s) => s.id === id);
  return mock ? toStop(mock) : null;
}

/** Fetch saved stops for a user. */
export async function getSavedStops(_userId: string): Promise<SavedStop[]> {
  // Will query saved_stops table once auth + DB are live
  return [];
}

/** Toggle a stop's saved state for the current user. */
export async function toggleSaveStop(_stopId: string): Promise<{ saved: boolean }> {
  // Will insert/delete from saved_stops table once auth + DB are live
  return { saved: false };
}

/** Fetch reviews for a stop. */
export async function getReviews(_stopId: string): Promise<Review[]> {
  // Will query reviews table once DB is live
  return [];
}
