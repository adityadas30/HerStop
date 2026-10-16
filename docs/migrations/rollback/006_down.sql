-- DEVELOPMENT/STAGING ONLY. Deletes ALL source='openstreetmap' rows, including
-- later ingestion or edits. Requires explicit acceptance of that data loss:
-- set herstop.rollback_006_allow_osm_loss = 'on';
-- Set this in the SAME SQL Editor session after exporting and stopping clients.
-- Even with the flag, dependent saves/reviews cause an abort (no silent cascade).
-- Restores exactly the explicit six seed values in 001, NOT live TEST rename,
-- original created_at values, lost saves/reviews, or overwritten OSM values.
-- Recover those from the pre-apply CSV backup, not from seed reconstruction.
begin;
set local lock_timeout = '5s';
lock table public.stops, public.saved_stops, public.reviews in access exclusive mode;
do $$
begin
  if exists (select 1 from public.stops where source = 'openstreetmap') then
    if current_setting('herstop.rollback_006_allow_osm_loss', true) is distinct from 'on' then
      raise exception '006 rollback requires explicit OSM data-loss flag';
    end if;
    if exists (select 1 from public.saved_stops s join public.stops t on t.id=s.stop_id where t.source='openstreetmap')
       or exists (select 1 from public.reviews r join public.stops t on t.id=r.stop_id where t.source='openstreetmap') then
      raise exception '006 rollback refuses dependent user data loss';
    end if;
  end if;
end $$;
create temporary table herstop_legacy_seed (like public.stops including defaults) on commit drop;
insert into herstop_legacy_seed (id, source_id, name, address, latitude, longitude, badge, categories, tags, rating, review_count, image_color) values
('1','1','Willow Creek Plaza','1420 Willow Creek Rd, Exit 42',40.5642,-74.2891,'recommended','{"Gas","Restroom","Well Lit"}','[{"label":"Well Lit","icon":"lightbulb.fill"},{"label":"Clean Restroom","icon":"sparkles"}]',4.6,128,'#C9B8A8'),
('2','2','The Atlas Point','780 Route 1 South, Woodbridge',40.5573,-74.2846,'good','{"Gas","Open Now"}','[{"label":"Staffed 24/7","icon":"person.fill"},{"label":"CCTV Monitored","icon":"video.fill"}]',3.9,42,'#B8A898'),
('3','3','Meridian Transit Hub','55 Meridian Blvd, Newark',40.7357,-74.1724,'recommended','{"Well Lit","Open Now"}','[{"label":"Safety Help Point","icon":"shield.fill"},{"label":"High Visibility","icon":"lightbulb.fill"}]',4.4,87,'#8B9DAF'),
('4','4','Cedar Falls Rest Area','I-78 West, Mile Marker 34',40.6684,-74.6851,'recommended','{"Restroom","Well Lit"}','[{"label":"Clean Restroom","icon":"sparkles"},{"label":"Well Lit","icon":"lightbulb.fill"},{"label":"CCTV Monitored","icon":"video.fill"}]',4.2,63,'#A8B5A3'),
('5','5','Sunrise Travel Center','2200 US-9, Old Bridge',40.3987,-74.2654,'recommended','{"Gas","Restroom","Open Now","Well Lit"}','[{"label":"Well Lit","icon":"lightbulb.fill"},{"label":"Clean Restroom","icon":"sparkles"},{"label":"Staffed 24/7","icon":"person.fill"}]',4.8,214,'#D4C1A8'),
('6','6','Harbor View Stop','410 Harbor Blvd, Perth Amboy',40.5093,-74.2652,'good','{"Open Now"}','[{"label":"CCTV Monitored","icon":"video.fill"}]',3.5,18,'#9BADB8');
do $$
begin
  if exists (
    select 1 from public.stops s join herstop_legacy_seed l using (id)
    where (to_jsonb(s) - 'created_at' - 'updated_at') is distinct from
          (to_jsonb(l) - 'created_at' - 'updated_at')
  ) then raise exception '006 rollback refuses to overwrite changed/reserved legacy IDs'; end if;
end $$;
delete from public.stops where source = 'openstreetmap';
insert into public.stops select * from herstop_legacy_seed on conflict (id) do nothing;
commit;
