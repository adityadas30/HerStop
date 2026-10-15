-- ============================================================
-- HerStop — stops table
-- Run this in the Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- Stops table
-- Using text IDs to match the current UI navigation flow (stop/[id])
create table if not exists stops (
  id           text primary key,
  name         text not null,
  address      text not null,
  latitude     float8 not null default 0,
  longitude    float8 not null default 0,
  badge        text not null default 'good' check (badge in ('recommended', 'good')),
  categories   text[] not null default '{}',
  tags         jsonb not null default '[]',
  rating       float4 not null default 0,
  review_count int not null default 0,
  image_url    text,
  image_color  text not null default '#C9B8A8',
  created_at   timestamptz not null default now()
);

-- Allow anonymous reads (no auth yet)
alter table stops enable row level security;
create policy "Public read access" on stops for select using (true);

-- ============================================================
-- Seed data — matches MOCK_STOPS in data/mock-stops.ts exactly
-- ============================================================

insert into stops (id, name, address, latitude, longitude, badge, categories, tags, rating, review_count, image_color)
values
  (
    '1',
    'Willow Creek Plaza',
    '1420 Willow Creek Rd, Exit 42',
    40.5642, -74.2891,
    'recommended',
    '{"Gas","Restroom","Well Lit"}',
    '[{"label":"Well Lit","icon":"lightbulb.fill"},{"label":"Clean Restroom","icon":"sparkles"}]',
    4.6, 128,
    '#C9B8A8'
  ),
  (
    '2',
    'The Atlas Point',
    '780 Route 1 South, Woodbridge',
    40.5573, -74.2846,
    'good',
    '{"Gas","Open Now"}',
    '[{"label":"Staffed 24/7","icon":"person.fill"},{"label":"CCTV Monitored","icon":"video.fill"}]',
    3.9, 42,
    '#B8A898'
  ),
  (
    '3',
    'Meridian Transit Hub',
    '55 Meridian Blvd, Newark',
    40.7357, -74.1724,
    'recommended',
    '{"Well Lit","Open Now"}',
    '[{"label":"Safety Help Point","icon":"shield.fill"},{"label":"High Visibility","icon":"lightbulb.fill"}]',
    4.4, 87,
    '#8B9DAF'
  ),
  (
    '4',
    'Cedar Falls Rest Area',
    'I-78 West, Mile Marker 34',
    40.6684, -74.6851,
    'recommended',
    '{"Restroom","Well Lit"}',
    '[{"label":"Clean Restroom","icon":"sparkles"},{"label":"Well Lit","icon":"lightbulb.fill"},{"label":"CCTV Monitored","icon":"video.fill"}]',
    4.2, 63,
    '#A8B5A3'
  ),
  (
    '5',
    'Sunrise Travel Center',
    '2200 US-9, Old Bridge',
    40.3987, -74.2654,
    'recommended',
    '{"Gas","Restroom","Open Now","Well Lit"}',
    '[{"label":"Well Lit","icon":"lightbulb.fill"},{"label":"Clean Restroom","icon":"sparkles"},{"label":"Staffed 24/7","icon":"person.fill"}]',
    4.8, 214,
    '#D4C1A8'
  ),
  (
    '6',
    'Harbor View Stop',
    '410 Harbor Blvd, Perth Amboy',
    40.5093, -74.2652,
    'good',
    '{"Open Now"}',
    '[{"label":"CCTV Monitored","icon":"video.fill"}]',
    3.5, 18,
    '#9BADB8'
  );

-- ============================================================
-- auth-otp-foundation (2026-09-06) — no schema change here
--
-- Email OTP sign-in (apps/mobile/lib/auth.ts) uses Supabase's built-in
-- `auth.users` table — nothing to create. It does need email OTP enabled
-- in the Supabase dashboard (founder action, not done by an agent):
--   Authentication → Providers → Email → confirm "Email" is enabled
--   Authentication → Email Templates → "Confirm signup" / "Magic Link"
--     templates should include {{ .Token }} so users receive a 6-digit
--     code (not just a magic-link URL) — verify this if `verifyOtp`
--     rejects a code that looks correct.
--
-- No `profiles` table yet — deferred until a real feature needs it
-- (e.g. a display name). A proposed schema exists for when that happens:
-- see docs/migrations/002_auth_tables.sql (not applied).
-- No `saved_stops` or `reviews` tables yet either — same file, same status.
-- ============================================================
