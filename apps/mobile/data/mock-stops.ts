import { SymbolViewProps } from 'expo-symbols';

// ---------- Types ----------

export type BadgeType = 'recommended' | 'good';

export interface StopTag {
  label: string;
  icon: SymbolViewProps['name'];
}

export interface StopData {
  id: string;
  name: string;
  address: string;
  distance: string;
  distanceMiles: number;
  badge: BadgeType;
  tags: StopTag[];
  imageColor: string;
  categories: string[];
  rating: number;
  reviewCount: number;
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

export const MOCK_STOPS: StopData[] = [
  {
    id: '1',
    name: 'Willow Creek Plaza',
    address: '1420 Willow Creek Rd, Exit 42',
    distance: '2.5 miles away',
    distanceMiles: 2.5,
    badge: 'recommended',
    imageColor: '#C9B8A8',
    categories: ['Gas', 'Restroom', 'Well Lit'],
    rating: 4.6,
    reviewCount: 128,
    tags: [
      { label: 'Well Lit', icon: 'lightbulb.fill' },
      { label: 'Clean Restroom', icon: 'sparkles' },
    ],
  },
  {
    id: '2',
    name: 'The Atlas Point',
    address: '780 Route 1 South, Woodbridge',
    distance: '3.1 miles away',
    distanceMiles: 3.1,
    badge: 'good',
    imageColor: '#B8A898',
    categories: ['Gas', 'Open Now'],
    rating: 3.9,
    reviewCount: 42,
    tags: [
      { label: 'Staffed 24/7', icon: 'person.fill' },
      { label: 'CCTV Monitored', icon: 'video.fill' },
    ],
  },
  {
    id: '3',
    name: 'Meridian Transit Hub',
    address: '55 Meridian Blvd, Newark',
    distance: '4.8 miles away',
    distanceMiles: 4.8,
    badge: 'recommended',
    imageColor: '#8B9DAF',
    categories: ['Well Lit', 'Open Now'],
    rating: 4.4,
    reviewCount: 87,
    tags: [
      { label: 'Safety Help Point', icon: 'shield.fill' },
      { label: 'High Visibility', icon: 'lightbulb.fill' },
    ],
  },
  {
    id: '4',
    name: 'Cedar Falls Rest Area',
    address: 'I-78 West, Mile Marker 34',
    distance: '6.2 miles away',
    distanceMiles: 6.2,
    badge: 'recommended',
    imageColor: '#A8B5A3',
    categories: ['Restroom', 'Well Lit'],
    rating: 4.2,
    reviewCount: 63,
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
    distance: '7.5 miles away',
    distanceMiles: 7.5,
    badge: 'recommended',
    imageColor: '#D4C1A8',
    categories: ['Gas', 'Restroom', 'Open Now', 'Well Lit'],
    rating: 4.8,
    reviewCount: 214,
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
    distance: '9.0 miles away',
    distanceMiles: 9.0,
    badge: 'good',
    imageColor: '#9BADB8',
    categories: ['Open Now'],
    rating: 3.5,
    reviewCount: 18,
    tags: [
      { label: 'CCTV Monitored', icon: 'video.fill' },
    ],
  },
];

// ---------- Helpers ----------

export function getStopById(id: string): StopData | undefined {
  return MOCK_STOPS.find((s) => s.id === id);
}
