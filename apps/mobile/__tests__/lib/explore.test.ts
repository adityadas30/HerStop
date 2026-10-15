import { MOCK_STOPS } from '@/data/mock-stops';
import { filterStops, getExploreLocationNote, getExploreResultCount } from '@/lib/explore';

function search(query = '', filters: string[] = []) {
  return filterStops({ stops: MOCK_STOPS, query, selectedFilters: new Set(filters) });
}

describe('filterStops', () => {
  it('matches a single filter', () => {
    expect(search('', ['Gas']).map((stop) => stop.id)).toEqual(['1', '2', '5']);
  });

  it('requires both Gas and Restroom, so adding a filter narrows results', () => {
    expect(search('', ['Gas', 'Restroom']).map((stop) => stop.id)).toEqual(['1', '5']);
  });

  it('requires every selected category, including the static Open Now tag', () => {
    expect(search('', ['Gas', 'Restroom', 'Open Now']).map((stop) => stop.id)).toEqual(['5']);
  });

  it('combines search and filters', () => {
    expect(search('willow', ['Gas', 'Restroom']).map((stop) => stop.id)).toEqual(['1']);
    expect(search('atlas', ['Gas', 'Restroom'])).toEqual([]);
  });

  it('returns the catalog in its existing order for an empty query without filters', () => {
    expect(search()).toEqual(MOCK_STOPS);
  });

  it('returns no results for an unmatched query', () => {
    expect(search('no such stop')).toEqual([]);
  });

  it('trims whitespace and matches names without case sensitivity', () => {
    expect(search('  wILLoW CREEK  ').map((stop) => stop.id)).toEqual(['1']);
  });

  it('matches addresses without case sensitivity', () => {
    expect(search('  ROUTE 1 SOUTH  ').map((stop) => stop.id)).toEqual(['2']);
  });

  it('treats whitespace-only queries as empty while still applying filters', () => {
    expect(search(' \n\t ')).toEqual(MOCK_STOPS);
    expect(search('   ', ['Gas'])).toEqual(search('', ['Gas']));
  });

  it('handles an empty catalog', () => {
    expect(filterStops({ stops: [], query: 'gas', selectedFilters: new Set(['Gas']) })).toEqual([]);
  });

  it('does not mutate the catalog or selected filters', () => {
    const stops = Object.freeze([...MOCK_STOPS]);
    const filters = new Set(['Gas', 'Restroom']);
    const result = filterStops({ stops, query: '', selectedFilters: filters });
    result.reverse();
    expect(stops).toEqual(MOCK_STOPS);
    expect([...filters]).toEqual(['Gas', 'Restroom']);
  });
});

describe('getExploreResultCount', () => {
  it.each([0, 1, 2])('formats %i matches while a search is active', (count) => {
    expect(getExploreResultCount({ query: 'willow', selectedFilters: new Set(), count }))
      .toBe(`${count} ${count === 1 ? 'stop' : 'stops'} found`);
  });

  it('shows a count when an active search matches the entire catalog', () => {
    const stops = [MOCK_STOPS[0], MOCK_STOPS[1]];
    const query = 'o';
    const selectedFilters = new Set<string>();
    const matches = filterStops({ stops, query, selectedFilters });
    expect(matches).toHaveLength(stops.length);
    expect(getExploreResultCount({ query, selectedFilters, count: matches.length })).toBe('2 stops found');
  });

  it('shows a count when filters match the entire catalog with a whitespace query', () => {
    const stops = [MOCK_STOPS[0], MOCK_STOPS[1]];
    const query = '   ';
    const selectedFilters = new Set(['Gas']);
    const matches = filterStops({ stops, query, selectedFilters });
    expect(matches).toHaveLength(stops.length);
    expect(getExploreResultCount({ query, selectedFilters, count: matches.length })).toBe('2 stops found');
  });

  it.each(['', '   '])('does not show a count without active search or filters (%j)', (query) => {
    expect(getExploreResultCount({ query, selectedFilters: new Set(), count: 6 })).toBeNull();
  });
});

describe('getExploreLocationNote', () => {
  it('shows progress while finding location', () => {
    expect(getExploreLocationNote({ status: 'loading' })).toBe('Finding your location…');
  });

  it('explains how permission denial affects sorting', () => {
    expect(getExploreLocationNote({ status: 'denied' })).toBe('Turn on location to sort by distance');
  });

  it('distinguishes an unavailable location from denied permission', () => {
    expect(getExploreLocationNote({ status: 'unavailable' }))
      .toBe("Couldn't get your location, so stops aren't sorted by distance");
  });

  it('hides the location note once coordinates are granted', () => {
    expect(getExploreLocationNote({ status: 'granted', coords: { latitude: 0, longitude: 0 } }))
      .toBeNull();
  });
});
