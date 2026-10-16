-- QUERY: begin
begin;
-- QUERY: rollback
rollback;
-- QUERY: anon
set local role anon;
-- QUERY: authenticated
set local role authenticated;
-- QUERY: owner
reset role;
-- QUERY: claims
select set_config('request.jwt.claims', $1, true);
-- QUERY: counts
select (select count(*)::int from stops) stops,
 (select count(*)::int from saved_stops) saves,
 (select count(*)::int from reviews) reviews,
 (select count(*)::int from profiles) profiles,
 (select count(*)::int from auth.users) users;
-- QUERY: seed_count
select count(*)::int n from stops;
-- QUERY: seed_payload
select to_jsonb(s) - 'created_at' - 'source' - 'source_id' - 'stop_type' - 'updated_at' - 'safety_context' as row from stops s order by id;
-- QUERY: live_fixture
insert into auth.users values ('10000000-0000-0000-0000-000000000001','synthetic-live@example.invalid');
insert into saved_stops(user_id,stop_id) values
 ('10000000-0000-0000-0000-000000000001','1'),
 ('10000000-0000-0000-0000-000000000001','2');
update stops set name='Willow Creek Plaza TEST' where id='1';
-- QUERY: export_stops
select to_jsonb(s) payload from stops s order by id;
-- QUERY: export_saves
select to_jsonb(s) payload from saved_stops s order by id;
-- QUERY: restore_stops
insert into stops select * from jsonb_populate_recordset(null::stops, $1::jsonb)
on conflict(id) do update set name=excluded.name,address=excluded.address,
 latitude=excluded.latitude,longitude=excluded.longitude,badge=excluded.badge,
 categories=excluded.categories,tags=excluded.tags,rating=excluded.rating,
 review_count=excluded.review_count,image_url=excluded.image_url,
 image_color=excluded.image_color,created_at=excluded.created_at,
 source=excluded.source,source_id=excluded.source_id,stop_type=excluded.stop_type,
 safety_context=excluded.safety_context;
-- QUERY: restore_saves
insert into saved_stops select * from jsonb_populate_recordset(null::saved_stops, $1::jsonb);
-- QUERY: rollback_flags
select set_config('herstop.rollback_003_clients_ready','on',false),
 set_config('herstop.rollback_005_columns_unused','on',false),
 set_config('herstop.rollback_006_allow_osm_loss','on',false);
-- QUERY: clear_flags
select set_config('herstop.rollback_003_clients_ready','off',false),
 set_config('herstop.rollback_005_columns_unused','off',false),
 set_config('herstop.rollback_006_allow_osm_loss','off',false);
-- QUERY: guard_save
insert into saved_stops(user_id,stop_id) values ('10000000-0000-0000-0000-000000000001','osm-node-7759210731');
-- QUERY: guard_review
insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit)
values ('10000000-0000-0000-0000-000000000001','osm-node-7759210731',3,3,3,3,3,'low',true,'day');
-- QUERY: guard_provider
update stops set safety_context='{"test":true}' where id='1';
-- QUERY: guard_ban
insert into banned_users(user_id) values ('10000000-0000-0000-0000-000000000001');
-- QUERY: guard_reserved
insert into stops(id,name,address,source_id) values ('1','Changed user stop','Synthetic','1');
-- QUERY: other_provider_fixture
insert into stops(id,name,address,source,source_id) values ('local-other-provider','Synthetic preservation fixture','Synthetic','other-provider','local-other-provider');
-- QUERY: other_provider_check
select count(*)::int n from stops where id='local-other-provider' and source='other-provider';
-- QUERY: other_provider_cleanup
delete from stops where id='local-other-provider';
-- QUERY: snapshot
select kind, name, detail from (
 select 'table' kind, c.relname name, jsonb_build_object('rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text) detail
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
 union all
 select 'column', c.relname || '.' || a.attname,
 jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid))
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped
 union all
 select 'policy', tablename || '.' || policyname, to_jsonb(p) - 'schemaname' from pg_policies p where schemaname='public'
 union all
 select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
 jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 union all
 select 'constraint', c.relname || '.' || co.conname, to_jsonb(pg_get_constraintdef(co.oid))
 from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 union all
 select 'index', indexname, to_jsonb(indexdef) from pg_indexes where schemaname='public'
 union all
 select 'trigger', c.relname || '.' || t.tgname, to_jsonb(pg_get_triggerdef(t.oid))
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal
) s order by kind, name;
