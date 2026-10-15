/**
 * lib/api.ts — stops read path (t6): release builds must never invent places.
 */

import { MOCK_STOPS } from '@/data/mock-stops';
import { getStopById, getStops } from '@/lib/api';
const mockState: {
  configured: boolean;
  result: { data: unknown; error: unknown } | { throws: unknown };
} = { configured: true, result: { data: [], error: null } };

jest.mock('@/lib/supabase', () => {
  const settle = () => {
    const r = mockState.result;
    if ('throws' in r) return Promise.reject(r.throws);
    return Promise.resolve(r);
  };
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => settle(),
    eq: () => builder,
    maybeSingle: () => settle(),
  };
  return {
    get supabaseConfigured() {
      return mockState.configured;
    },
    supabase: { from: () => builder },
  };
});

const g = global as unknown as { __DEV__: boolean };
const originalDev = g.__DEV__;

const ROW = {
  id: 'stop-1',
  name: 'Live Stop',
  address: '1 Real Road',
  tags: [{ label: 'Lit', icon: 'lightbulb' }],
  image_color: '#abcdef',
  categories: ['bus'],
  latitude: 1.5,
  longitude: 2.5,
};

beforeEach(() => {
  mockState.configured = true;
  mockState.result = { data: [], error: null };
  g.__DEV__ = false;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  g.__DEV__ = originalDev;
  jest.restoreAllMocks();
});

describe('getStops — release build (__DEV__ = false)', () => {
  it('unconfigured → empty stops + error, never MOCK_STOPS', async () => {
    mockState.configured = false;
    const r = await getStops();
    expect(r.stops).toEqual([]);
    expect(r.error).toEqual(expect.any(String));
    expect(r.stops).not.toBe(MOCK_STOPS);
  });

  it('supabase error → empty stops + error, never MOCK_STOPS', async () => {
    mockState.result = { data: null, error: { code: '500', message: 'boom' } };
    const r = await getStops();
    expect(r.stops).toEqual([]);
    expect(r.error).not.toBeNull();
  });

  it('thrown network failure → empty stops + error', async () => {
    mockState.result = { throws: new Error('network down') };
    const r = await getStops();
    expect(r).toEqual({ stops: [], error: expect.any(String) });
  });

  it('empty table → empty stops, error null', async () => {
    const r = await getStops();
    expect(r).toEqual({ stops: [], error: null });
  });

  it('rows are mapped to StopData', async () => {
    mockState.result = { data: [ROW], error: null };
    const r = await getStops();
    expect(r.error).toBeNull();
    expect(r.stops).toEqual([
      {
        id: 'stop-1',
        name: 'Live Stop',
        address: '1 Real Road',
        tags: [{ label: 'Lit', icon: 'lightbulb' }],
        imageColor: '#abcdef',
        categories: ['bus'],
        latitude: 1.5,
        longitude: 2.5,
      },
    ]);
  });
});

describe('getStops — development build (__DEV__ = true)', () => {
  beforeEach(() => {
    g.__DEV__ = true;
  });

  it('unconfigured → MOCK_STOPS allowed', async () => {
    mockState.configured = false;
    expect(await getStops()).toEqual({ stops: MOCK_STOPS, error: null });
  });

  it('supabase error → MOCK_STOPS allowed', async () => {
    mockState.result = { data: null, error: { message: 'boom' } };
    expect(await getStops()).toEqual({ stops: MOCK_STOPS, error: null });
  });

  it('0 rows → MOCK_STOPS allowed', async () => {
    expect(await getStops()).toEqual({ stops: MOCK_STOPS, error: null });
  });
});

describe('getStopById', () => {
  it('ok — row found', async () => {
    mockState.result = { data: ROW, error: null };
    const r = await getStopById('stop-1');
    expect(r.status).toBe('ok');
    expect(r.stop?.id).toBe('stop-1');
    expect(r.stop?.imageColor).toBe('#abcdef');
  });

  it('not_found — maybeSingle returns null (release)', async () => {
    mockState.result = { data: null, error: null };
    expect(await getStopById('missing')).toEqual({ stop: null, status: 'not_found' });
  });

  it('error — supabase error (release)', async () => {
    mockState.result = { data: null, error: { message: 'boom' } };
    expect(await getStopById('stop-1')).toEqual({ stop: null, status: 'error' });
  });

  it('error — thrown failure (release)', async () => {
    mockState.result = { throws: new Error('offline') };
    expect(await getStopById('stop-1')).toEqual({ stop: null, status: 'error' });
  });

  it('error — unconfigured (release) never returns a mock stop', async () => {
    mockState.configured = false;
    expect(await getStopById(MOCK_STOPS[0].id)).toEqual({ stop: null, status: 'error' });
  });

  it('dev: no live row falls back to the mock stop with that id', async () => {
    g.__DEV__ = true;
    mockState.result = { data: null, error: null };
    const r = await getStopById(MOCK_STOPS[0].id);
    expect(r.status).toBe('ok');
    expect(r.stop?.id).toBe(MOCK_STOPS[0].id);
  });

  it('dev: unknown id with no live row is not_found', async () => {
    g.__DEV__ = true;
    mockState.result = { data: null, error: null };
    expect((await getStopById('nope-nope')).status).toBe('not_found');
  });
});
