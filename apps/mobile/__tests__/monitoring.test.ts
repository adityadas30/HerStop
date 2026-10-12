import { initMonitoring, scrubBreadcrumb, scrubEvent, scrubString } from '@/lib/monitoring';

describe('scrubString', () => {
  it('removes emails', () => {
    expect(scrubString('failed for jane.doe+x@example.com today')).toBe('failed for [redacted] today');
  });
  it('removes JWTs and bearer tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abcDEF123_-xyz';
    expect(scrubString(`token ${jwt} here`)).not.toContain('eyJ');
    expect(scrubString('Authorization: Bearer abc.def-123')).toBe('Authorization: Bearer [redacted]');
  });
  it('removes coordinate pairs and lat/long key-values', () => {
    expect(scrubString('at 37.774929, -122.419416')).not.toMatch(/37\.77/);
    expect(scrubString('/rpc?lat=37.7749&lng=-122.4194')).toBe('/rpc?lat=[redacted]&lng=[redacted]');
    expect(scrubString('{"latitude": 37.7749}')).not.toContain('37.7749');
  });
  it('removes token query params', () => {
    expect(scrubString('https://x.co/cb?access_token=secret123&a=1')).toBe(
      'https://x.co/cb?access_token=[redacted]&a=1',
    );
  });
  it('leaves harmless text alone', () => {
    expect(scrubString('Stop 42 rendered in 120ms')).toBe('Stop 42 rendered in 120ms');
  });
});

describe('scrubEvent', () => {
  it('redacts sensitive keys deeply and drops user + request payloads', () => {
    const out = scrubEvent({
      message: 'oops for a@b.co',
      user: { id: '1', email: 'a@b.co', ip_address: '1.2.3.4' },
      request: { url: 'https://x/?token=abc', data: { review: 'lovely' }, headers: { a: 'b' } },
      extra: {
        review_text: 'Great stop, felt fine',
        latitude: 37.7,
        longitude: -122.4,
        nested: { Authorization: 'Bearer zzz', list: [{ email: 'q@r.st' }] },
        stopId: 'abc',
      },
    }) as any;
    expect(out.user).toBeUndefined();
    expect(out.request.data).toBeUndefined();
    expect(out.request.headers).toBeUndefined();
    expect(out.request.url).toBe('https://x/?token=[redacted]');
    expect(out.message).toBe('oops for [redacted]');
    expect(out.extra.review_text).toBe('[redacted]');
    expect(out.extra.latitude).toBe('[redacted]');
    expect(out.extra.longitude).toBe('[redacted]');
    expect(out.extra.nested.Authorization).toBe('[redacted]');
    expect(out.extra.nested.list[0].email).toBe('[redacted]');
    expect(out.extra.stopId).toBe('abc');
  });

  it('does not mutate its input', () => {
    const input = { extra: { email: 'a@b.co' } };
    scrubEvent(input);
    expect(input.extra.email).toBe('a@b.co');
  });
});

describe('scrubBreadcrumb', () => {
  it('scrubs breadcrumb message and data', () => {
    const out = scrubBreadcrumb({
      message: 'GET /stops?lat=1.2345&lng=2.3456',
      data: { url: 'https://x/?apikey=k', coords: { latitude: 1.2 } },
    }) as any;
    expect(out.message).toBe('GET /stops?lat=[redacted]&lng=[redacted]');
    expect(out.data.url).toBe('https://x/?apikey=[redacted]');
    expect(out.data.coords).toBe('[redacted]');
  });
});

describe('initMonitoring', () => {
  it('is a no-op without a DSN', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    expect(initMonitoring()).toBe(false);
    process.env.EXPO_PUBLIC_SENTRY_DSN = '   ';
    expect(initMonitoring()).toBe(false);
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });
});
