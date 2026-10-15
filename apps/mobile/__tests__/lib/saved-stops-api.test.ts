import { getSavedStops, toggleSaveStop } from '@/lib/api';

const mockState = { configured: true };
const mockRead = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => mockRead(),
  };
  return {
    get supabaseConfigured() {
      return mockState.configured;
    },
    supabase: {
      from: (...args: unknown[]) => {
        mockFrom(...args);
        return builder;
      },
    },
  };
});

const g = global as unknown as { __DEV__: boolean };
const originalDev = g.__DEV__;

beforeEach(() => {
  mockState.configured = true;
  mockRead.mockReset();
  mockFrom.mockClear();
  g.__DEV__ = false;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  g.__DEV__ = originalDev;
  jest.restoreAllMocks();
});

it('returns an explicit error for a failed saved-stop query', async () => {
  mockRead.mockResolvedValue({ data: null, error: { message: 'denied' } });
  expect(await getSavedStops('user-1')).toEqual({ savedStops: [], error: expect.any(String) });
});

it('returns an explicit error for a rejected saved-stop query', async () => {
  mockRead.mockRejectedValue(new Error('offline'));
  expect(await getSavedStops('user-1')).toEqual({ savedStops: [], error: expect.any(String) });
});

it('distinguishes a successful empty saved list from failure', async () => {
  mockRead.mockResolvedValue({ data: [], error: null });
  expect(await getSavedStops('user-1')).toEqual({ savedStops: [], error: null });
});

it('returns saved rows on success', async () => {
  const rows = [{ id: 'save-1', user_id: 'user-1', stop_id: 'stop-1', created_at: '2026-10-14' }];
  mockRead.mockResolvedValue({ data: rows, error: null });
  expect(await getSavedStops('user-1')).toEqual({ savedStops: rows, error: null });
});

describe.each([true, false])('unconfigured, __DEV__=%s', (dev) => {
  beforeEach(() => {
    g.__DEV__ = dev;
    mockState.configured = false;
  });

  it('does not present a read as empty success', async () => {
    expect(await getSavedStops('user-1')).toEqual({ savedStops: [], error: expect.any(String) });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([true, false])('rejects a save toggle to %s without reporting success', async (nextSaved) => {
    expect(await toggleSaveStop('stop-1', nextSaved)).toEqual({
      saved: !nextSaved,
      error: expect.any(String),
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
