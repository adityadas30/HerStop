import { SymbolViewProps } from 'expo-symbols';

// ---------- Types ----------

export interface StopTag {
  label: string;
  icon: SymbolViewProps['name'];
}

export interface StopData {
  id: string;
  name: string;
  address: string;
  tags: StopTag[];
  imageColor: string;
  categories: string[];
  latitude: number;
  longitude: number;
  /** True only for fictional demo stops. Real catalog stops leave this unset. */
  isMock?: boolean;
}

export interface FilterOption {
  label: string;
  icon: SymbolViewProps['name'];
}

// ---------- Filters ----------

export const FILTERS: FilterOption[] = [
  { label: 'Gas', icon: 'fuelpump.fill' },
  { label: 'Restroom', icon: 'drop.fill' },
  { label: 'Open Now', icon: 'clock.fill' },
  { label: 'Well Lit', icon: 'lightbulb.fill' },
];

// ---------- Mock stops ----------
// Mock/demo data only — no rating, review count, or badge here on purpose.
// Those must come from real reviews via scoreStop(), never be invented.
//
// These are NOT real places. Names, addresses and coordinates are fictional
// demo values and do not match each other: an address here is not where its
// coordinates point. Never treat them as navigation or location evidence —
// Directions uses the coordinates, so a mock stop may open somewhere that
// does not look like its address.

const MOCK_STOP_ROWS: StopData[] = [
  {
    id: '1',
    name: 'Willow Creek Plaza',
    address: '1420 Willow Creek Rd, Exit 42',
    imageColor: '#C9B8A8',
    categories: ['Gas', 'Restroom', 'Well Lit'],
    latitude: 40.5642,
    longitude: -74.2891,
    tags: [
      { label: 'Well Lit', icon: 'lightbulb.fill' },
      { label: 'Clean Restroom', icon: 'sparkles' },
    ],
  },
  {
    id: '2',
    name: 'The Atlas Point',
    address: '780 Route 1 South, Woodbridge',
    imageColor: '#B8A898',
    categories: ['Gas', 'Open Now'],
    latitude: 40.5573,
    longitude: -74.2846,
    tags: [
      { label: 'Staffed 24/7', icon: 'person.fill' },
      { label: 'CCTV Monitored', icon: 'video.fill' },
    ],
  },
  {
    id: '3',
    name: 'Meridian Transit Hub',
    address: '55 Meridian Blvd, Newark',
    imageColor: '#8B9DAF',
    categories: ['Well Lit', 'Open Now'],
    latitude: 40.7357,
    longitude: -74.1724,
    tags: [
      { label: 'Safety Help Point', icon: 'shield.fill' },
      { label: 'High Visibility', icon: 'lightbulb.fill' },
    ],
  },
  {
    id: '4',
    name: 'Cedar Falls Rest Area',
    address: 'I-78 West, Mile Marker 34',
    imageColor: '#A8B5A3',
    categories: ['Restroom', 'Well Lit'],
    latitude: 40.6684,
    longitude: -74.6851,
    tags: [
      { label: 'Clean Restroom', icon: 'sparkles' },
      { label: 'Well Lit', icon: 'lightbulb.fill' },
      { label: 'CCTV Monitored', icon: 'video.fill' },
    ],
  },
  {
    id: '5',
    name: 'Sunrise Travel Center',
    address: '2200 US-9, Old Bridge',
    imageColor: '#D4C1A8',
    categories: ['Gas', 'Restroom', 'Open Now', 'Well Lit'],
    latitude: 40.3987,
    longitude: -74.2654,
    tags: [
      { label: 'Well Lit', icon: 'lightbulb.fill' },
      { label: 'Clean Restroom', icon: 'sparkles' },
      { label: 'Staffed 24/7', icon: 'person.fill' },
    ],
  },
  {
    id: '6',
    name: 'Harbor View Stop',
    address: '410 Harbor Blvd, Perth Amboy',
    imageColor: '#9BADB8',
    categories: ['Open Now'],
    latitude: 40.5093,
    longitude: -74.2652,
    tags: [
      { label: 'CCTV Monitored', icon: 'video.fill' },
    ],
  },
];

/** Every demo stop carries an explicit `isMock` marker (never inferred from missing reviews). */
export const MOCK_STOPS: StopData[] = MOCK_STOP_ROWS.map((stop) => ({ ...stop, isMock: true }));

const MOCK_STOP_IDS: ReadonlySet<string> = new Set(MOCK_STOPS.map((stop) => stop.id));

/**
 * True for ids that belong to the fictional demo catalog. docs/schema.sql seeds
 * the same six rows into Supabase with these ids, so a database row can be a
 * demo stop too. Real stops use other ids (e.g. "osm-node-…").
 */
export function isMockStopId(id: string): boolean {
  return MOCK_STOP_IDS.has(id);
}

// ---------- Helpers ----------

export function getStopById(id: string): StopData | undefined {
  return MOCK_STOPS.find((s) => s.id === id);
}
