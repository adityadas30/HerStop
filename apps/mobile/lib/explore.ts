import type { StopData } from '@/data/mock-stops';
import type { LocationResult } from '@/lib/location';

interface ExploreFilters {
  query: string;
  selectedFilters: ReadonlySet<string>;
}

interface FilterStopsOptions extends ExploreFilters {
  stops: readonly StopData[];
}

export function filterStops({ stops, query, selectedFilters }: FilterStopsOptions): StopData[] {
  const search = query.trim().toLowerCase();
  const filters = [...selectedFilters];

  return stops.filter((stop) => {
    const matchesSearch = stop.name.toLowerCase().includes(search)
      || stop.address.toLowerCase().includes(search);
    // "Open Now" in mock data is a static category tag, not a real-time hours check.
    const matchesFilters = filters.every((filter) => stop.categories.includes(filter));
    return matchesSearch && matchesFilters;
  });
}

export function getExploreResultCount({
  query,
  selectedFilters,
  count,
}: ExploreFilters & { count: number }): string | null {
  if (!query.trim() && selectedFilters.size === 0) return null;
  return `${count} stop${count === 1 ? '' : 's'} found`;
}

export type ExploreLocationState = LocationResult | { status: 'loading' };

export function getExploreLocationNote(location: ExploreLocationState): string | null {
  switch (location.status) {
    case 'loading':
      return 'Finding your location…';
    case 'denied':
      return 'Turn on location to sort by distance';
    case 'unavailable':
      return "Couldn't get your location, so stops aren't sorted by distance";
    case 'granted':
      return null;
  }
}
