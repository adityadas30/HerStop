// Crash reporting (Sentry), gated on EXPO_PUBLIC_SENTRY_DSN and privacy-safe.
//
// - No DSN (or empty) => complete no-op; the app runs normally.
// - sendDefaultPii is false, no session replay, no performance tracing.
// - Every event/breadcrumb goes through scrubEvent/scrubBreadcrumb, which strip
//   emails, coordinates, auth tokens and review text before anything leaves the device.

const REDACTED = '[redacted]';

// Keys whose values are always dropped, wherever they appear in an event.
const SENSITIVE_KEY =
  /^(lat|lng|lon|long|latitude|longitude|coords?|coordinates?|location|position|user_?location|email|e-?mail|token|access_?token|refresh_?token|id_?token|auth|authorization|cookie|set-cookie|password|passcode|otp|code|secret|api_?key|apikey|anon_?key|review|review_?text|reviews|comment|comments|body|message_?text|text|content|phone)$/i;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// JWTs (Supabase access/refresh tokens) and "Bearer xxx".
const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
// A lat,long pair with decimals, e.g. "37.7749, -122.4194" or "37.7749,-122.4194".
const COORD_PAIR_RE = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g;
// Query/JSON style: lat=37.77, "longitude": -122.4
const COORD_KV_RE = /\b(lat|lng|lon|long|latitude|longitude)\b(["']?\s*[:=]\s*)-?\d{1,3}(\.\d+)?/gi;
// token=..., access_token=..., apikey=... in URLs or messages.
const TOKEN_KV_RE =
  /\b(access_token|refresh_token|id_token|token|apikey|api_key|key|code)=([^&\s"']+)/gi;

export function scrubString(value: string): string {
  return value
    .replace(JWT_RE, REDACTED)
    .replace(BEARER_RE, `Bearer ${REDACTED}`)
    .replace(EMAIL_RE, REDACTED)
    .replace(COORD_KV_RE, (_m, k: string, sep: string) => `${k}${sep}${REDACTED}`)
    .replace(COORD_PAIR_RE, REDACTED)
    .replace(TOKEN_KV_RE, (_m, k: string) => `${k}=${REDACTED}`);
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 8) return REDACTED;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : scrubValue(v, depth + 1);
  }
  return out;
}

// Generic over the Sentry event shape so this file doesn't need the SDK types
// (and stays importable from jest without loading native modules).
export function scrubEvent<T extends object>(event: T): T {
  const e = scrubValue(event) as Record<string, unknown>;
  // Never send user identity or request payloads.
  delete e.user;
  const request = e.request as Record<string, unknown> | undefined;
  if (request) {
    delete request.data;
    delete request.cookies;
    delete request.headers;
    delete request.query_string;
  }
  return e as T;
}

export function scrubBreadcrumb<T extends object>(breadcrumb: T): T {
  return scrubValue(breadcrumb) as T;
}

let initialised = false;
let loggedNoop = false;

/** Initialise Sentry if (and only if) a DSN is configured. Safe to call repeatedly. */
export function initMonitoring(): boolean {
  if (initialised) return true;
  const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();
  if (!dsn) {
    if (__DEV__ && !loggedNoop) {
      loggedNoop = true;
      console.log('[monitoring] EXPO_PUBLIC_SENTRY_DSN not set — crash reporting disabled.');
    }
    return false;
  }
  // Lazy require keeps the SDK out of the no-DSN path and out of unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    // No session replay: replay integrations are intentionally not added.
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
  initialised = true;
  return true;
}
