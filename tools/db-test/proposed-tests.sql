-- Runs AFTER 008 and 009 are applied. Each case: fixtures.sql + fixture_published_edits,
-- then rolled back. Upserts mirror the app's PostgREST upsert on (user_id, stop_id).
-- CASE: 008 no-op upsert and no-op update are NOT edits
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit,note)
values (auth.uid(),'osm-node-7759210731',4,4,4,4,4,'low',true,'day','Synthetic A')
on conflict (user_id,stop_id) do update set overall_feeling=excluded.overall_feeling,lighting=excluded.lighting,
 restroom_quality=excluded.restroom_quality,cleanliness=excluded.cleanliness,staff_kindness=excluded.staff_kindness,
 loitering_concern=excluded.loitering_concern,would_stop_again=excluded.would_stop_again,
 time_of_visit=excluded.time_of_visit,note=excluded.note;
select test.ok((select edited_at=created_at and edited_at<now()-interval '2 days' from reviews),'identical upsert keeps edited_at');
update reviews set note=note, created_at='2000-01-01', is_hidden=true;
select test.ok((select edited_at=created_at and edited_at<now()-interval '2 days' from reviews),'pinned-field-only update keeps edited_at');
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731') where id='20000000-0000-0000-0000-000000000002'),'no-op leaves review published');
-- CASE: 008 ratings-only edit IS an edit; note-only edit IS an edit
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit,note)
values (auth.uid(),'osm-node-7759210731',4,2,4,4,4,'low',true,'day','Synthetic A')
on conflict (user_id,stop_id) do update set overall_feeling=excluded.overall_feeling,lighting=excluded.lighting,
 restroom_quality=excluded.restroom_quality,cleanliness=excluded.cleanliness,staff_kindness=excluded.staff_kindness,
 loitering_concern=excluded.loitering_concern,would_stop_again=excluded.would_stop_again,
 time_of_visit=excluded.time_of_visit,note=excluded.note;
select test.ok((select edited_at=now() and lighting=2 and note='Synthetic A' from reviews),'ratings-only upsert sets edited_at');
reset role;
update reviews set edited_at=created_at;
set local role authenticated;
update reviews set note='Synthetic note-only edit';
select test.ok((select edited_at=now() and lighting=2 from reviews),'note-only update sets edited_at');
-- CASE: 008 author still sees own review after edit; client cannot forge edited_at
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update reviews set note='Synthetic delayed edit',edited_at='2000-01-01';
select test.ok((select edited_at=now() from reviews),'client cannot forge edit timestamp');
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731') where is_mine and note='Synthetic delayed edit'),'author sees own edited review');
select test.ok((select count(*)=1 from reviews),'author direct read still works');
-- CASE: 008 KNOWN RISK: an edit makes the published review vanish for others immediately (timing signal)
-- PASS means the accepted-for-staging risk is reproduced; see staging-runbook DECISION BOX.
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731') where id='20000000-0000-0000-0000-000000000002'),'A review published before edit');
select test.ok((select review_count=2 from get_stop_review_stats(array['osm-node-7759210731'])),'stats count A before edit');
reset role;
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update reviews set lighting=3;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select test.ok((select count(*)=0 from get_stop_reviews('osm-node-7759210731') where id='20000000-0000-0000-0000-000000000002'),'KNOWN RISK reproduced: old published version gone for anon');
select test.ok((select review_count=1 from get_stop_review_stats(array['osm-node-7759210731'])),'KNOWN RISK reproduced: aggregate drops immediately');
reset role;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select test.ok((select count(*)=0 from get_stop_reviews('osm-node-7759210731') where id='20000000-0000-0000-0000-000000000002'),'KNOWN RISK reproduced: old published version gone for B');
-- CASE: 008 edited text is delayed, blocks other-viewer RPCs, republishes after the daily cutoff
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update reviews set note='Synthetic delayed edit';
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select test.ok((select count(*)=0 from get_stop_reviews('osm-node-7759210731') where note='Synthetic delayed edit'),'edited text is delayed');
reset role;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select test.denied($q$select report_review('20000000-0000-0000-0000-000000000002','spam')$q$,'P0001');
select test.denied($q$select hide_review('20000000-0000-0000-0000-000000000002')$q$,'P0001');
reset role;
-- Exactly at the cutoff the edit is still unpublished; 1 microsecond before, it is published.
update reviews set edited_at=date_trunc('day',now()-review_publish_delay()) where user_id='20000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select test.ok((select count(*)=0 from get_stop_reviews('osm-node-7759210731') where note='Synthetic delayed edit'),'edit at cutoff still delayed');
reset role;
update reviews set edited_at=date_trunc('day',now()-review_publish_delay())-interval '1 microsecond' where user_id='20000000-0000-0000-0000-000000000001';
set local role anon;
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731') where note='Synthetic delayed edit'),'edited text republishes after cutoff');
select test.ok((select review_count=2 from get_stop_review_stats(array['osm-node-7759210731'])),'stats restore published edit');
reset role;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select report_review('20000000-0000-0000-0000-000000000002','spam');
select hide_review('20000000-0000-0000-0000-000000000002');
reset role;
select test.ok((select count(*)=1 from review_reports) and (select count(*)=1 from hidden_reviews),'RPCs work once republished');
-- CASE: 009 other users cannot edit or delete another's review; banned author cannot insert/update
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
with u as (update reviews set note='Cross-user edit' where id='20000000-0000-0000-0000-000000000002' returning 1)
select test.ok((select count(*)=0 from u),'B cannot update A review');
with d as (delete from reviews where id='20000000-0000-0000-0000-000000000002' returning 1)
select test.ok((select count(*)=0 from d),'B cannot delete A review');
reset role;
select test.ok((select note='Synthetic A' and edited_at=created_at from reviews where id='20000000-0000-0000-0000-000000000002'),'A review unchanged, not marked edited');
insert into banned_users(user_id) values ('20000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select test.denied($q$update reviews set note='banned edit'$q$);
select test.denied($q$insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit) values (auth.uid(),'osm-node-9446063174',3,3,3,3,3,'low',true,'day')$q$);
-- CASE: 009 review write policies apply to authenticated only
reset role;
select test.ok((select bool_and(roles=array['authenticated']::name[]) and count(*)=3 from pg_policies
 where schemaname='public' and tablename='reviews' and cmd in ('INSERT','UPDATE','DELETE')),'insert/update/delete policies are to authenticated');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"anon"}',true);
set local role anon;
-- Even with a forged sub claim, anon has no write policy.
select test.denied($q$insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit) values (auth.uid(),'osm-node-9446063174',3,3,3,3,3,'low',true,'day')$q$);
with u as (update reviews set note='anon edit' returning 1) select test.ok((select count(*)=0 from u),'anon update matches no policy');
with d as (delete from reviews returning 1) select test.ok((select count(*)=0 from d),'anon delete matches no policy');
-- CASE: 009 closes arbitrary UUID oracle and banned-caller RPCs
insert into banned_users(user_id) values ('30000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select test.ok(is_caller_banned(),'caller can read own ban');
select test.denied($q$select is_banned('20000000-0000-0000-0000-000000000001')$q$);
select test.denied($q$select report_review('20000000-0000-0000-0000-000000000002','spam')$q$);
select test.denied($q$select hide_review('20000000-0000-0000-0000-000000000002')$q$);
reset role;
select test.ok((select count(*)=0 from review_reports) and (select count(*)=0 from hidden_reviews),'banned caller wrote nothing');
select test.ok((select bool_and(prosecdef and proconfig=array['search_path=""']) and count(*)=3 from pg_proc
 where oid in ('report_review(uuid,text,text)'::regprocedure,'hide_review(uuid)'::regprocedure,'is_caller_banned()'::regprocedure)),
 'moderation RPCs are definer with empty search_path');
-- CASE: 009 TRUNCATE denied on EVERY public table for anon and authenticated
do $$
declare t text; r text; n int := 0; before jsonb; after jsonb;
begin
 before := test.public_row_counts();
 perform test.ok((select array_agg(tablename::text order by tablename) from pg_tables where schemaname='public')
  = array['banned_users','hidden_reviews','profiles','review_reports','reviews','saved_stops','stops'],'expected public table set');
 foreach r in array array['anon','authenticated'] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub','20000000-0000-0000-0000-000000000001','role',r)::text,true);
  execute format('set local role %I',r);
  for t in select tablename from pg_tables where schemaname='public' loop
   perform test.denied(format('truncate table public.%I',t));
   n := n + 1;
  end loop;
  reset role;
 end loop;
 perform test.ok(n=14,'14 role/table truncate attempts');
 perform test.ok(not exists (select 1 from pg_tables t cross join (values ('anon'),('authenticated')) g(r)
  where t.schemaname='public' and has_table_privilege(g.r,format('public.%I',t.tablename),'truncate,references,trigger')),
  'no truncate/references/trigger privilege remains');
 after := test.public_row_counts();
 perform test.ok(before=after and (before->>'stops')::int>0 and (before->>'reviews')::int=2,'row counts unchanged after denied truncates');
end $$;
-- CASE: 009 function EXECUTE allowlist holds despite simulated broad default grants
select test.ok(not has_function_privilege('anon','review_publish_delay()','execute')
 and not has_function_privilege('authenticated','review_publish_delay()','execute'),'review_publish_delay owner-only');
select test.ok(not has_function_privilege('authenticated','is_banned(uuid)','execute'),'is_banned owner-only');
select test.ok(not has_function_privilege('authenticated','reviews_enforce_invariants()','execute')
 and not has_function_privilege('authenticated','set_stops_updated_at()','execute'),'trigger functions owner-only');
select test.ok(has_function_privilege('anon','get_stop_reviews(text)','execute')
 and has_function_privilege('anon','get_stop_review_stats(text[])','execute'),'public read RPCs remain for anon');
select test.ok(not has_function_privilege('anon','is_caller_banned()','execute')
 and not has_function_privilege('anon','report_review(uuid,text,text)','execute')
 and not has_function_privilege('anon','delete_my_account()','execute'),'anon has no account/moderation RPCs');
select test.ok(has_function_privilege('authenticated','delete_my_account()','execute')
 and has_function_privilege('authenticated','report_review(uuid,text,text)','execute'),'authenticated keeps allowlisted RPCs');
set local role anon;
select test.denied('select review_publish_delay()');
reset role;
-- Triggers still fire without client EXECUTE on the trigger function.
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update reviews set note='Trigger still fires';
select test.ok((select edited_at=now() from reviews),'invariant trigger still runs for clients');
-- CASE: 009 default ACLs: objects the creator makes later get no client truncate/execute
create table public.zz_future_table(id int);
create function public.zz_future_fn() returns int language sql as $$ select 1 $$;
select test.ok(not has_table_privilege('anon','public.zz_future_table','truncate')
 and not has_table_privilege('authenticated','public.zz_future_table','truncate,references,trigger'),'future table: no truncate/references/trigger');
select test.ok(has_table_privilege('authenticated','public.zz_future_table','select'),'future table: unrelated simulated grants untouched');
select test.ok(not has_function_privilege('anon','public.zz_future_fn()','execute')
 and not has_function_privilege('authenticated','public.zz_future_fn()','execute'),'future function: no PUBLIC/anon/authenticated execute');
-- CASE: KNOWN LIMITATION: 009 cannot change another role's default ACLs (why the runbook re-inventories)
create role zz_other_creator nologin;
grant create, usage on schema public to zz_other_creator;
alter default privileges for role zz_other_creator in schema public grant execute on functions to anon;
set local role zz_other_creator;
create function public.zz_other_fn() returns int language sql as $$ select 1 $$;
reset role;
select test.ok(has_function_privilege('anon','public.zz_other_fn()','execute'),'LIMITATION reproduced: other role default ACL still grants anon execute');
