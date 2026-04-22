/** Matches the future `stops` table in Supabase. */
export interface Stop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  badge: 'recommended' | 'good';
  categories: string[];
  tags: StopTag[];
  image_url: string | null;
  rating: number;
  review_count: number;
  created_at: string;
}

export interface StopTag {
  label: string;
  icon: string;
}

/** Matches the future `reviews` table in Supabase. */
export interface Review {
  id: string;
  stop_id: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
}

/** Matches the future `saved_stops` join table in Supabase. */
export interface SavedStop {
  id: string;
  user_id: string;
  stop_id: string;
  created_at: string;
}
