jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const g = global as unknown as { __DEV__: boolean };
const originalDev = g.__DEV__;
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

beforeEach(() => {
  jest.resetModules();
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected network request'));
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  g.__DEV__ = originalDev;
  jest.restoreAllMocks();
});

describe.each([true, false])('missing configuration, __DEV__=%s', (dev) => {
  it.each(['both', 'url', 'key'])('imports without throwing when %s is missing', async (missing) => {
    g.__DEV__ = dev;
    if (missing === 'url') process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-public-key';
    if (missing === 'key') process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid';

    // Use the real SDK constructor: mocking createClient would hide the regression.
    const client = jest.requireActual<typeof import('@/lib/supabase')>('@/lib/supabase');
    expect(client.supabaseConfigured).toBe(false);
    const { data } = await client.supabase.auth.getSession();
    expect(data.session).toBeNull();

    const result = await client.supabase.from('stops').select('*');
    expect(result.error).not.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    if (!dev) {
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    }
  });
});
